import { localDate, localMinutes, addDays, toMinutes, fromMinutes } from './time.js';

const DUE_WINDOW_MIN = 60; // after this many minutes past the dose time, a dose counts as overdue

export const iso = (d) => (d == null ? null : d instanceof Date ? d.toISOString() : new Date(d).toISOString());

export function scheduledFor(db, userId) {
  return db.query(`
    SELECT s.id AS schedule_id, s.time, m.id AS medication_id, m.name, m.dosage, m.start_date
    FROM schedules s JOIN medications m ON m.id = s.medication_id
    WHERE m.user_id = $1 AND m.active AND NOT m.as_needed
    ORDER BY s.time, s.id`, [userId]);
}

/** Every dose for one day, with status computed against the user's local clock. */
export async function dosesForDay(db, user, day, now = new Date()) {
  const today = localDate(user.timezone, now);
  const nowMin = localMinutes(user.timezone, now);
  const schedules = (await scheduledFor(db, user.id)).filter((s) => s.start_date <= day);
  const ids = schedules.map((s) => s.schedule_id);
  const [overrides, logs] = ids.length
    ? await Promise.all([
      db.query('SELECT schedule_id, time, snoozed_until FROM dose_overrides WHERE date = $1 AND schedule_id = ANY($2::int[])', [day, ids]),
      db.query('SELECT schedule_id, status, taken_at FROM dose_logs WHERE date = $1 AND schedule_id = ANY($2::int[])', [day, ids]),
    ])
    : [[], []];
  const ovBy = new Map(overrides.map((o) => [o.schedule_id, o]));
  const logBy = new Map(logs.map((l) => [l.schedule_id, l]));

  const doses = schedules.map((s) => {
    const ov = ovBy.get(s.schedule_id) || {};
    const log = logBy.get(s.schedule_id);
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
      takenAt: iso(log?.taken_at),
      minutesUntil: day === today ? toMinutes(effective) - nowMin : null,
    };
  });
  doses.sort((a, b) => a.time.localeCompare(b.time));

  const asNeeded = (await db.query(`
    SELECT m.id, m.name, m.dosage,
      (SELECT COUNT(*)::int FROM dose_logs l WHERE l.medication_id = m.id AND l.date = $1 AND l.status = 'taken') AS taken_count,
      (SELECT MAX(taken_at) FROM dose_logs l WHERE l.medication_id = m.id AND l.date = $1) AS last_taken
    FROM medications m WHERE m.user_id = $2 AND m.active AND m.as_needed AND m.start_date <= $1
    ORDER BY m.name`, [day, user.id]))
    .map((m) => ({ kind: 'as_needed', medicationId: m.id, name: m.name, dosage: m.dosage, takenCount: m.taken_count, lastTakenAt: iso(m.last_taken) }));

  return { doses, asNeeded };
}

/** Map of day -> { required, taken } for scheduled doses between two days (inclusive). */
export async function completionByDay(db, userId, from, to, schedules) {
  schedules = schedules || await scheduledFor(db, userId);
  const logs = await db.query(`SELECT date, schedule_id FROM dose_logs WHERE user_id = $1 AND status = 'taken' AND schedule_id IS NOT NULL AND date BETWEEN $2 AND $3`, [userId, from, to]);
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

export async function earliestStart(db, userId) {
  return (await db.one('SELECT MIN(start_date) AS d FROM medications WHERE user_id = $1', [userId])).d;
}

/**
 * Consecutive fully-completed days ending today. Today only adds to the streak once it is
 * complete; an unfinished today does not break it. Days with nothing scheduled are skipped.
 */
export function streakFrom(map, today, from) {
  let streak = 0;
  for (let d = today; d >= from; d = addDays(d, -1)) {
    const c = map.get(d);
    if (d === today) { if (complete(c)) streak++; continue; }
    if (!c || c.required === 0) continue;
    if (complete(c)) streak++; else break;
  }
  return streak;
}

export async function computeStreak(db, user, now = new Date()) {
  const today = localDate(user.timezone, now);
  const start = await earliestStart(db, user.id);
  if (!start) return 0;
  const from = start > addDays(today, -730) ? start : addDays(today, -730);
  return streakFrom(await completionByDay(db, user.id, from, today), today, from);
}

function windowStats(map, from, today, todayDoses) {
  let taken = 0, total = 0;
  for (const [d, c] of map) {
    if (d < from || d >= today) continue;
    taken += c.taken; total += c.required;
  }
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

export async function dashboard(db, user, now = new Date()) {
  const today = localDate(user.timezone, now);
  const [{ doses, asNeeded }, start, schedules, totals] = await Promise.all([
    dosesForDay(db, user, today, now),
    earliestStart(db, user.id),
    scheduledFor(db, user.id),
    db.one(`SELECT COUNT(*)::int AS n FROM dose_logs WHERE user_id = $1 AND status = 'taken'`, [user.id]),
  ]);
  const first = start || today;
  const clamp = (d) => (d < first ? first : d);
  const histFrom = clamp(addDays(today, -730));
  const map = await completionByDay(db, user.id, histFrom, today, schedules);

  const streak = streakFrom(map, today, histFrom);
  const week = windowStats(map, clamp(addDays(today, -6)), today, doses);
  const month = windowStats(map, clamp(`${today.slice(0, 8)}01`), today, doses);
  const remaining = doses.filter((d) => d.status !== 'taken' && d.status !== 'skipped').length;
  const nextDose = doses.find((d) => !['taken', 'skipped'].includes(d.status)) || null;
  const completeDays = [...map.values()].filter(complete).length;

  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    const c = map.get(d) || { required: 0, taken: 0 };
    last7.push({ date: d, complete: !!complete(c), required: c.required, taken: c.taken });
  }

  return {
    date: today,
    now: fromMinutes(localMinutes(user.timezone, now)),
    doses,
    asNeeded,
    remaining,
    nextDose,
    overdueCount: doses.filter((d) => d.status === 'overdue').length,
    streak,
    week,
    month,
    last7,
    garden: { plants: totals.n, blooms: completeDays, ...stageFor(streak) },
  };
}

export async function history(db, user, days, now = new Date()) {
  const today = localDate(user.timezone, now);
  const from = addDays(today, -(days - 1));
  const map = await completionByDay(db, user.id, from, today);
  return [...map.entries()].map(([date, c]) => ({ date, ...c, complete: !!complete(c) }));
}
