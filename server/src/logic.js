import { localDate, localMinutes, addDays, toMinutes, daysBetween, fromMinutes } from './time.js';

const DUE_WINDOW_MIN = 60; // after this many minutes past the dose time, a dose counts as overdue

export function scheduledFor(db, userId) {
  return db.prepare(`
    SELECT s.id AS schedule_id, s.time, m.id AS medication_id, m.name, m.dosage, m.start_date
    FROM schedules s JOIN medications m ON m.id = s.medication_id
    WHERE m.user_id = ? AND m.active = 1 AND m.as_needed = 0
    ORDER BY s.time`).all(userId);
}

/** Every dose for one day, with status computed against the user's local clock. */
export function dosesForDay(db, user, day, now = new Date()) {
  const today = localDate(user.timezone, now);
  const nowMin = localMinutes(user.timezone, now);
  const schedules = scheduledFor(db, user.id).filter((s) => s.start_date <= day);
  const ovStmt = db.prepare('SELECT time, snoozed_until FROM dose_overrides WHERE schedule_id = ? AND date = ?');
  const logStmt = db.prepare('SELECT status, taken_at FROM dose_logs WHERE schedule_id = ? AND date = ?');

  const doses = schedules.map((s) => {
    const ov = ovStmt.get(s.schedule_id, day) || {};
    const log = logStmt.get(s.schedule_id, day);
    const time = ov.time || s.time;
    const effective = ov.snoozed_until || time;
    let status;
    if (log) status = log.status; // taken | skipped
    else if (day > today) status = 'upcoming';
    else if (day < today) status = 'missed';
    else {
      const diff = nowMin - toMinutes(effective);
      status = diff < 0 ? 'upcoming' : diff <= DUE_WINDOW_MIN ? 'due' : 'overdue';
    }
    return {
      kind: 'scheduled',
      scheduleId: s.schedule_id,
      medicationId: s.medication_id,
      name: s.name,
      dosage: s.dosage,
      time,
      baseTime: s.time,
      snoozedUntil: ov.snoozed_until || null,
      status,
      takenAt: log?.taken_at ? `${log.taken_at.replace(' ', 'T')}Z` : null,
      minutesUntil: day === today ? toMinutes(effective) - nowMin : null,
    };
  });
  doses.sort((a, b) => a.time.localeCompare(b.time));

  const prn = db.prepare(`
    SELECT m.id, m.name, m.dosage,
      (SELECT COUNT(*) FROM dose_logs l WHERE l.medication_id = m.id AND l.date = ? AND l.status = 'taken') AS taken_count,
      (SELECT MAX(taken_at) FROM dose_logs l WHERE l.medication_id = m.id AND l.date = ?) AS last_taken
    FROM medications m WHERE m.user_id = ? AND m.active = 1 AND m.as_needed = 1 AND m.start_date <= ?
    ORDER BY m.name`).all(day, day, user.id, day)
    .map((m) => ({ kind: 'as_needed', medicationId: m.id, name: m.name, dosage: m.dosage, takenCount: m.taken_count, lastTakenAt: m.last_taken ? `${m.last_taken.replace(' ', 'T')}Z` : null }));

  return { doses, asNeeded: prn };
}

/** Map of day -> { required, taken } for scheduled doses between two days (inclusive). */
export function completionByDay(db, userId, from, to) {
  const schedules = scheduledFor(db, userId);
  const logs = db.prepare(`SELECT date, schedule_id FROM dose_logs WHERE user_id = ? AND status = 'taken' AND schedule_id IS NOT NULL AND date BETWEEN ? AND ?`).all(userId, from, to);
  const byDay = new Map();
  for (const l of logs) {
    if (!byDay.has(l.date)) byDay.set(l.date, new Set());
    byDay.get(l.date).add(l.schedule_id);
  }
  const out = new Map();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const required = schedules.filter((s) => s.start_date <= d);
    const taken = byDay.get(d);
    out.set(d, { required: required.length, taken: taken ? required.filter((s) => taken.has(s.schedule_id)).length : 0 });
  }
  return out;
}

const complete = (c) => c && c.required > 0 && c.taken >= c.required;

export function earliestStart(db, userId) {
  return db.prepare('SELECT MIN(start_date) AS d FROM medications WHERE user_id = ?').get(userId).d;
}

/**
 * Consecutive fully-completed days ending today. Today only adds to the streak once it is
 * complete; an unfinished today does not break it. Days with nothing scheduled are skipped.
 */
export function computeStreak(db, user, now = new Date()) {
  const today = localDate(user.timezone, now);
  const start = earliestStart(db, user.id);
  if (!start) return 0;
  const from = start > addDays(today, -730) ? start : addDays(today, -730);
  const map = completionByDay(db, user.id, from, today);
  let streak = 0;
  for (let d = today; d >= from; d = addDays(d, -1)) {
    const c = map.get(d);
    if (d === today) { if (complete(c)) streak++; continue; }
    if (!c || c.required === 0) continue;
    if (complete(c)) streak++; else break;
  }
  return streak;
}

function windowStats(db, user, from, today, todayDoses) {
  const map = completionByDay(db, user.id, from, addDays(today, -1));
  let taken = 0, total = 0;
  for (const c of map.values()) { taken += c.taken; total += c.required; }
  // For today, only count doses that are already due (or were taken early).
  for (const d of todayDoses) {
    if (d.status === 'upcoming') continue;
    total++;
    if (d.status === 'taken') taken++;
  }
  return { taken, total, percent: total ? Math.round((taken / total) * 100) : 100 };
}

export function stageFor(streak) {
  if (streak >= 14) return { stage: 4, label: 'In full bloom' };
  if (streak >= 7) return { stage: 3, label: 'Budding' };
  if (streak >= 3) return { stage: 2, label: 'Sprouting' };
  return { stage: 1, label: 'Seedling' };
}

export function dashboard(db, user, now = new Date()) {
  const today = localDate(user.timezone, now);
  const { doses, asNeeded } = dosesForDay(db, user, today, now);
  const start = earliestStart(db, user.id) || today;
  const clamp = (d) => (d < start ? start : d);
  const streak = computeStreak(db, user, now);
  const week = windowStats(db, user, clamp(addDays(today, -6)), today, doses);
  const month = windowStats(db, user, clamp(`${today.slice(0, 8)}01`), today, doses);

  const remaining = doses.filter((d) => d.status !== 'taken' && d.status !== 'skipped').length;
  const nextDose = doses.find((d) => !['taken', 'skipped'].includes(d.status)) || null;
  const overdue = doses.filter((d) => d.status === 'overdue');

  const totalTaken = db.prepare(`SELECT COUNT(*) AS n FROM dose_logs WHERE user_id = ? AND status = 'taken'`).get(user.id).n;
  const map = completionByDay(db, user.id, clamp(addDays(today, -365)), today);
  const completeDays = [...map.values()].filter(complete).length;

  // Last 7 days as a strip of sprouts for the UI.
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    const c = map.get(d) || { required: 0, taken: 0 };
    last7.push({ date: d, complete: complete(c), required: c.required, taken: c.taken });
  }

  return {
    date: today,
    now: fromMinutes(localMinutes(user.timezone, now)),
    doses,
    asNeeded,
    remaining,
    nextDose,
    overdueCount: overdue.length,
    streak,
    week,
    month,
    last7,
    garden: { plants: totalTaken, blooms: completeDays, ...stageFor(streak) },
  };
}

export function history(db, user, days, now = new Date()) {
  const today = localDate(user.timezone, now);
  const from = addDays(today, -(days - 1));
  const map = completionByDay(db, user.id, from, today);
  return [...map.entries()].map(([date, c]) => ({ date, ...c, complete: complete(c) }));
}

export { daysBetween };
