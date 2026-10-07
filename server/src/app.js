import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { z, ZodError } from 'zod';
import { requireAuth, setSession, clearSession, publicUser, rateLimit } from './auth.js';
import { dashboard, dosesForDay, history, computeStreak } from './logic.js';
import { localDate, localMinutes, addDays, toMinutes, fromMinutes, weekStart, isValidTimeZone, TIME_RE } from './time.js';

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const notFound = (what) => new HttpError(404, `${what} not found.`);

const tz = z.string().refine(isValidTimeZone, 'Unknown time zone.');
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colour must look like #a1b2c3.');

const medSchema = z.object({
  name: z.string().trim().min(1, 'Give the medication a name.').max(80),
  dosage: z.string().trim().max(60).default('1 tablet'),
  withWater: z.boolean().default(true),
  instructions: z.string().trim().max(120).default(''),
  notes: z.string().trim().max(500).default(''),
  asNeeded: z.boolean().default(false),
  times: z.array(z.string().regex(TIME_RE, 'Times must be HH:MM, 24-hour.')).max(8).default([]),
}).refine((m) => m.asNeeded || m.times.length > 0, { message: 'Add at least one reminder time, or mark it as needed.', path: ['times'] });

const sqlTime = (s) => (s ? `${s.replace(' ', 'T')}Z` : null);

export function createApp(db, { clientDir } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const auth = requireAuth(db);
  const api = express.Router();
  const authLimit = rateLimit({ windowMs: 60_000, max: 20 });

  // ---------- auth ----------
  api.post('/auth/register', authLimit, (req, res) => {
    const body = z.object({
      name: z.string().trim().min(1, 'Tell us your name.').max(40),
      email: z.email('Enter a valid email address.'),
      password: z.string().min(8, 'Use at least 8 characters for your password.').max(200),
      timezone: tz.default('UTC'),
    }).parse(req.body);
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(body.email)) throw new HttpError(409, 'An account with that email already exists. Try signing in.');
    const hash = bcrypt.hashSync(body.password, 10);
    const { lastInsertRowid } = db.prepare('INSERT INTO users (name, email, password_hash, timezone) VALUES (?, ?, ?, ?)').run(body.name, body.email, hash, body.timezone);
    const general = db.prepare("SELECT id FROM groups WHERE slug = 'general-wellness'").get();
    if (general) db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').run(general.id, lastInsertRowid);
    setSession(res, lastInsertRowid);
    res.status(201).json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid)) });
  });

  api.post('/auth/login', authLimit, (req, res) => {
    const body = z.object({ email: z.string().trim(), password: z.string() }).parse(req.body);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(body.email);
    if (!user || !bcrypt.compareSync(body.password, user.password_hash)) throw new HttpError(401, 'That email and password don’t match. Check them and try again.');
    setSession(res, user.id);
    res.json({ user: publicUser(user) });
  });

  api.post('/auth/logout', (req, res) => { clearSession(res); res.json({ ok: true }); });

  // ---------- me ----------
  api.get('/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

  api.patch('/me', auth, (req, res) => {
    const body = z.object({
      name: z.string().trim().min(1).max(40).optional(),
      tagline: z.string().trim().max(80).optional(),
      timezone: tz.optional(),
      avatarColor: color.optional(),
      shareActivity: z.boolean().optional(),
      nudgesEnabled: z.boolean().optional(),
    }).parse(req.body);
    const map = { name: 'name', tagline: 'tagline', timezone: 'timezone', avatarColor: 'avatar_color', shareActivity: 'share_activity', nudgesEnabled: 'nudges_enabled' };
    const sets = [], vals = [];
    for (const [k, v] of Object.entries(body)) { sets.push(`${map[k]} = ?`); vals.push(typeof v === 'boolean' ? Number(v) : v); }
    if (sets.length) db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals, req.user.id);
    res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
  });

  api.get('/me/export', auth, (req, res) => {
    const id = req.user.id;
    const meds = db.prepare('SELECT * FROM medications WHERE user_id = ?').all(id);
    res.setHeader('Content-Disposition', 'attachment; filename="mochi-garden-export.json"');
    res.json({
      exportedAt: new Date().toISOString(),
      user: publicUser(req.user),
      medications: meds.map((m) => ({ ...m, times: db.prepare('SELECT time FROM schedules WHERE medication_id = ?').all(m.id).map((s) => s.time) })),
      doseLogs: db.prepare('SELECT medication_id, date, status, taken_at FROM dose_logs WHERE user_id = ? ORDER BY taken_at').all(id),
      groups: db.prepare('SELECT g.name, gm.joined_at FROM group_members gm JOIN groups g ON g.id = gm.group_id WHERE gm.user_id = ?').all(id),
    });
  });

  api.delete('/me', auth, (req, res) => {
    const { password } = z.object({ password: z.string() }).parse(req.body);
    if (!bcrypt.compareSync(password, req.user.password_hash)) throw new HttpError(403, 'That password is incorrect, so your account was not deleted.');
    db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
    clearSession(res);
    res.json({ ok: true });
  });

  // ---------- today / stats ----------
  api.get('/dashboard', auth, (req, res) => res.json(dashboard(db, req.user)));

  api.get('/history', auth, (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    res.json({ days: history(db, req.user, days) });
  });

  // ---------- medications ----------
  const medRow = (m) => ({
    id: m.id, name: m.name, dosage: m.dosage, withWater: !!m.with_water, instructions: m.instructions, notes: m.notes,
    asNeeded: !!m.as_needed, startDate: m.start_date,
    times: db.prepare('SELECT time FROM schedules WHERE medication_id = ? ORDER BY time').all(m.id).map((s) => s.time),
  });
  const ownMed = (req) => {
    const m = db.prepare('SELECT * FROM medications WHERE id = ? AND user_id = ? AND active = 1').get(Number(req.params.id), req.user.id);
    if (!m) throw notFound('Medication');
    return m;
  };

  api.get('/medications', auth, (req, res) => {
    res.json({ medications: db.prepare('SELECT * FROM medications WHERE user_id = ? AND active = 1 ORDER BY name').all(req.user.id).map(medRow) });
  });

  api.post('/medications', auth, (req, res) => {
    const m = medSchema.parse(req.body);
    const today = localDate(req.user.timezone);
    const id = db.transaction(() => {
      const { lastInsertRowid } = db.prepare(`INSERT INTO medications (user_id, name, dosage, with_water, instructions, notes, as_needed, start_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(req.user.id, m.name, m.dosage, Number(m.withWater), m.instructions, m.notes, Number(m.asNeeded), today);
      if (!m.asNeeded) for (const t of new Set(m.times)) db.prepare('INSERT INTO schedules (medication_id, time) VALUES (?, ?)').run(lastInsertRowid, t);
      return lastInsertRowid;
    })();
    res.status(201).json({ medication: medRow(db.prepare('SELECT * FROM medications WHERE id = ?').get(id)) });
  });

  api.get('/medications/:id', auth, (req, res) => res.json({ medication: medRow(ownMed(req)) }));

  api.put('/medications/:id', auth, (req, res) => {
    const existing = ownMed(req);
    const m = medSchema.parse(req.body);
    db.transaction(() => {
      db.prepare('UPDATE medications SET name = ?, dosage = ?, with_water = ?, instructions = ?, notes = ?, as_needed = ? WHERE id = ?')
        .run(m.name, m.dosage, Number(m.withWater), m.instructions, m.notes, Number(m.asNeeded), existing.id);
      const want = new Set(m.asNeeded ? [] : m.times);
      const have = db.prepare('SELECT id, time FROM schedules WHERE medication_id = ?').all(existing.id);
      for (const s of have) if (!want.has(s.time)) db.prepare('DELETE FROM schedules WHERE id = ?').run(s.id);
      const haveTimes = new Set(have.map((s) => s.time));
      for (const t of want) if (!haveTimes.has(t)) db.prepare('INSERT INTO schedules (medication_id, time) VALUES (?, ?)').run(existing.id, t);
    })();
    res.json({ medication: medRow(db.prepare('SELECT * FROM medications WHERE id = ?').get(existing.id)) });
  });

  api.delete('/medications/:id', auth, (req, res) => {
    const m = ownMed(req);
    db.prepare('UPDATE medications SET active = 0 WHERE id = ?').run(m.id); // keep history
    res.json({ ok: true });
  });

  api.post('/medications/:id/take', auth, (req, res) => {
    const m = ownMed(req);
    if (!m.as_needed) throw new HttpError(400, 'This medication has scheduled times. Check in from today’s doses instead.');
    db.prepare('INSERT INTO dose_logs (user_id, medication_id, schedule_id, date) VALUES (?, ?, NULL, ?)').run(req.user.id, m.id, localDate(req.user.timezone));
    res.json(dashboard(db, req.user));
  });

  // ---------- scheduled doses ----------
  const ownSchedule = (req) => {
    const s = db.prepare(`SELECT s.*, m.name, m.dosage, m.with_water, m.instructions, m.notes, m.user_id FROM schedules s JOIN medications m ON m.id = s.medication_id
      WHERE s.id = ? AND m.user_id = ? AND m.active = 1`).get(Number(req.params.scheduleId), req.user.id);
    if (!s) throw notFound('Dose');
    return s;
  };
  const doseDay = (req) => {
    const today = localDate(req.user.timezone);
    const day = req.body?.date || req.query.date || today;
    if (day !== today && day !== addDays(today, -1)) throw new HttpError(400, 'You can only check in for today or yesterday.');
    return day;
  };

  api.get('/doses/:scheduleId', auth, (req, res) => {
    const s = ownSchedule(req);
    const day = req.query.date || localDate(req.user.timezone);
    const dose = dosesForDay(db, req.user, day).doses.find((d) => d.scheduleId === s.id);
    const last = db.prepare("SELECT taken_at FROM dose_logs WHERE medication_id = ? AND status = 'taken' AND date < ? ORDER BY taken_at DESC LIMIT 1").get(s.medication_id, day);
    res.json({
      dose,
      medication: { id: s.medication_id, name: s.name, dosage: s.dosage, withWater: !!s.with_water, instructions: s.instructions, notes: s.notes },
      lastTakenAt: sqlTime(last?.taken_at),
    });
  });

  function recordShareEvents(user, day) {
    if (!user.share_activity) return;
    const has = db.prepare('SELECT 1 FROM events WHERE user_id = ? AND type = ? AND date = ?');
    const add = db.prepare('INSERT INTO events (user_id, type, value, date) VALUES (?, ?, ?, ?)');
    if (!has.get(user.id, 'checkin', day)) add.run(user.id, 'checkin', 0, day);
    const { remaining } = dashboard(db, user);
    if (remaining === 0) {
      const streak = computeStreak(db, user);
      if ((streak === 3 || (streak >= 7 && streak % 7 === 0)) && !has.get(user.id, 'streak', day)) add.run(user.id, 'streak', streak, day);
    }
  }

  api.post('/doses/:scheduleId/take', auth, (req, res) => {
    const s = ownSchedule(req);
    const day = doseDay(req);
    const r = db.prepare('INSERT OR IGNORE INTO dose_logs (user_id, medication_id, schedule_id, date) VALUES (?, ?, ?, ?)').run(req.user.id, s.medication_id, s.id, day);
    if (r.changes) recordShareEvents(req.user, day);
    res.json(dashboard(db, req.user));
  });

  api.post('/doses/:scheduleId/undo', auth, (req, res) => {
    const s = ownSchedule(req);
    db.prepare('DELETE FROM dose_logs WHERE schedule_id = ? AND date = ?').run(s.id, doseDay(req));
    res.json(dashboard(db, req.user));
  });

  api.post('/doses/:scheduleId/snooze', auth, (req, res) => {
    const s = ownSchedule(req);
    const { minutes } = z.object({ minutes: z.number().int().min(5).max(180).default(10) }).parse(req.body || {});
    const day = localDate(req.user.timezone);
    const ov = db.prepare('SELECT time FROM dose_overrides WHERE schedule_id = ? AND date = ?').get(s.id, day);
    const base = Math.max(localMinutes(req.user.timezone), toMinutes(ov?.time || s.time));
    const until = fromMinutes(Math.min(base + minutes, 23 * 60 + 59));
    db.prepare(`INSERT INTO dose_overrides (schedule_id, date, snoozed_until) VALUES (?, ?, ?)
      ON CONFLICT (schedule_id, date) DO UPDATE SET snoozed_until = excluded.snoozed_until`).run(s.id, day, until);
    res.json(dashboard(db, req.user));
  });

  api.post('/doses/:scheduleId/reschedule', auth, (req, res) => {
    const s = ownSchedule(req);
    const { time } = z.object({ time: z.string().regex(TIME_RE, 'Pick a time like 21:30.') }).parse(req.body);
    const day = localDate(req.user.timezone);
    db.prepare(`INSERT INTO dose_overrides (schedule_id, date, time, snoozed_until) VALUES (?, ?, ?, NULL)
      ON CONFLICT (schedule_id, date) DO UPDATE SET time = excluded.time, snoozed_until = NULL`).run(s.id, day, time);
    res.json(dashboard(db, req.user));
  });

  // ---------- community ----------
  api.get('/community', auth, (req, res) => {
    const today = localDate(req.user.timezone);
    const monday = weekStart(today);
    const weekCheckins = db.prepare("SELECT COUNT(*) AS n FROM dose_logs WHERE status = 'taken' AND date >= ?").get(monday).n;
    const members = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
    const encouragements = db.prepare("SELECT COUNT(*) AS n FROM cheers WHERE event_id IS NULL AND created_at >= datetime('now', '-7 days')").get().n;
    const neighbours = db.prepare(`SELECT DISTINCT u.id, u.name, u.avatar_color FROM events e JOIN users u ON u.id = e.user_id
      WHERE u.share_activity = 1 AND e.date >= ? ORDER BY e.created_at DESC LIMIT 8`).all(addDays(today, -2))
      .map((u) => ({ id: u.id, name: u.name, avatarColor: u.avatar_color }));
    res.json({ weekCheckins, goal: 1000, members, encouragements, neighbours, weekOf: monday });
  });

  api.post('/community/encourage', auth, (req, res) => {
    db.prepare('INSERT INTO cheers (from_user, event_id) VALUES (?, NULL)').run(req.user.id);
    const n = db.prepare("SELECT COUNT(*) AS n FROM cheers WHERE event_id IS NULL AND created_at >= datetime('now', '-7 days')").get().n;
    res.json({ encouragements: n });
  });

  api.get('/feed', auth, (req, res) => {
    const groupId = req.query.group ? Number(req.query.group) : null;
    const rows = db.prepare(`
      SELECT e.id, e.type, e.value, e.created_at, u.id AS user_id, u.name, u.avatar_color,
        (SELECT COUNT(*) FROM cheers c WHERE c.event_id = e.id) AS cheers,
        EXISTS (SELECT 1 FROM cheers c WHERE c.event_id = e.id AND c.from_user = @me) AS cheered
      FROM events e JOIN users u ON u.id = e.user_id
      WHERE (u.share_activity = 1 OR u.id = @me)
        AND (@group IS NULL OR u.id IN (SELECT user_id FROM group_members WHERE group_id = @group))
      ORDER BY e.created_at DESC, e.id DESC LIMIT 40`).all({ me: req.user.id, group: groupId });
    res.json({
      events: rows.map((r) => ({
        id: r.id, type: r.type, value: r.value, createdAt: sqlTime(r.created_at), cheers: r.cheers, cheered: !!r.cheered,
        user: { id: r.user_id, name: r.name, avatarColor: r.avatar_color, isMe: r.user_id === req.user.id },
      })),
    });
  });

  api.post('/feed/:id/cheer', auth, (req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT 1 FROM events WHERE id = ?').get(id)) throw notFound('Post');
    const existing = db.prepare('SELECT id FROM cheers WHERE event_id = ? AND from_user = ?').get(id, req.user.id);
    if (existing) db.prepare('DELETE FROM cheers WHERE id = ?').run(existing.id);
    else db.prepare('INSERT INTO cheers (from_user, event_id) VALUES (?, ?)').run(req.user.id, id);
    const cheers = db.prepare('SELECT COUNT(*) AS n FROM cheers WHERE event_id = ?').get(id).n;
    res.json({ id, cheers, cheered: !existing });
  });

  // ---------- groups ----------
  api.get('/groups', auth, (req, res) => {
    const today = localDate(req.user.timezone);
    const rows = db.prepare(`
      SELECT g.*, (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS members,
        EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = ?) AS joined,
        (SELECT COUNT(DISTINCT e.user_id) FROM events e JOIN group_members gm ON gm.user_id = e.user_id
          WHERE gm.group_id = g.id AND e.type = 'checkin' AND e.date = ?) AS checked_in_today
      FROM groups g ORDER BY g.id`).all(req.user.id, today);
    res.json({ groups: rows.map((g) => ({ id: g.id, slug: g.slug, name: g.name, description: g.description, color: g.color, icon: g.icon, members: g.members, joined: !!g.joined, checkedInToday: g.checked_in_today })) });
  });

  api.post('/groups/:id/join', auth, (req, res) => {
    const g = db.prepare('SELECT id FROM groups WHERE id = ?').get(Number(req.params.id));
    if (!g) throw notFound('Group');
    db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').run(g.id, req.user.id);
    res.json({ ok: true });
  });

  api.delete('/groups/:id/join', auth, (req, res) => {
    db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
    res.json({ ok: true });
  });

  api.use((req, res) => res.status(404).json({ error: 'That endpoint does not exist.' }));
  app.use('/api', api);

  // ---------- client ----------
  if (clientDir && fs.existsSync(path.join(clientDir, 'index.html'))) {
    app.use(express.static(clientDir, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(clientDir, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ZodError) return res.status(400).json({ error: err.issues[0]?.message || 'Some details are missing or invalid.' });
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request body was not valid JSON.' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
  });

  return app;
}
