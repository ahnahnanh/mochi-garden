import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { z, ZodError } from 'zod';
import { requireAuth as auth, setSession, clearSession, publicUser, rateLimit } from './auth.js';
import { dashboard, dosesForDay, history, computeStreak, iso } from './logic.js';
import { localDate, localMinutes, addDays, toMinutes, fromMinutes, weekStart, isValidTimeZone, TIME_RE } from './time.js';

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const notFound = (what) => new HttpError(404, `${what} not found.`);

const tz = z.string().refine(isValidTimeZone, 'Unknown time zone.');
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colour must look like #a1b2c3.');
const intId = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0 || n > 2147483647) throw new HttpError(404, 'Not found.');
  return n;
};

const medSchema = z.object({
  name: z.string().trim().min(1, 'Give the medication a name.').max(80),
  dosage: z.string().trim().max(60).default('1 tablet'),
  withWater: z.boolean().default(true),
  instructions: z.string().trim().max(120).default(''),
  notes: z.string().trim().max(500).default(''),
  asNeeded: z.boolean().default(false),
  times: z.array(z.string().regex(TIME_RE, 'Times must be HH:MM, 24-hour.')).max(8).default([]),
}).refine((m) => m.asNeeded || m.times.length > 0, { message: 'Add at least one reminder time, or mark it as needed.', path: ['times'] });

/**
 * @param db  a database from openDb(), or a promise of one, or a function returning that promise
 */
export function createApp(db, { clientDir } = {}) {
  const getDb = typeof db === 'function' ? db : () => Promise.resolve(db);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const api = express.Router();
  const authLimit = rateLimit({ windowMs: 60_000, max: 20 });

  api.use(async (req, res, next) => {
    try { req.db = await getDb(); next(); } catch (e) {
      console.error(e);
      res.status(503).json({ error: e.message.includes('DATABASE_URL') ? e.message : 'The database is unavailable right now. Please try again shortly.' });
    }
  });

  api.get('/health', async (req, res) => { await req.db.one('SELECT 1 AS ok'); res.json({ ok: true }); });

  // ---------- auth ----------
  api.post('/auth/register', authLimit, async (req, res) => {
    const body = z.object({
      name: z.string().trim().min(1, 'Tell us your name.').max(40),
      email: z.email('Enter a valid email address.').transform((e) => e.toLowerCase()),
      password: z.string().min(8, 'Use at least 8 characters for your password.').max(200),
      timezone: tz.default('UTC'),
    }).parse(req.body);
    const hash = await bcrypt.hash(body.password, 10);
    const user = await req.db.one(
      'INSERT INTO users (name, email, password_hash, timezone) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING RETURNING *',
      [body.name, body.email, hash, body.timezone]);
    if (!user) throw new HttpError(409, 'An account with that email already exists. Try signing in.');
    await req.db.run(`INSERT INTO group_members (group_id, user_id) SELECT id, $1 FROM community_groups WHERE slug = 'general-wellness' ON CONFLICT DO NOTHING`, [user.id]);
    await setSession(req, res, user.id);
    res.status(201).json({ user: publicUser(user) });
  });

  api.post('/auth/login', authLimit, async (req, res) => {
    const body = z.object({ email: z.string().trim(), password: z.string() }).parse(req.body);
    const user = await req.db.one('SELECT * FROM users WHERE email = $1', [body.email.toLowerCase()]);
    if (!user || !(await bcrypt.compare(body.password, user.password_hash))) throw new HttpError(401, 'That email and password don’t match. Check them and try again.');
    await setSession(req, res, user.id);
    res.json({ user: publicUser(user) });
  });

  api.post('/auth/logout', (req, res) => { clearSession(res); res.json({ ok: true }); });

  // ---------- me ----------
  api.get('/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

  api.patch('/me', auth, async (req, res) => {
    const body = z.object({
      name: z.string().trim().min(1).max(40).optional(),
      tagline: z.string().trim().max(80).optional(),
      timezone: tz.optional(),
      avatarColor: color.optional(),
      shareActivity: z.boolean().optional(),
      nudgesEnabled: z.boolean().optional(),
    }).parse(req.body);
    const cols = { name: 'name', tagline: 'tagline', timezone: 'timezone', avatarColor: 'avatar_color', shareActivity: 'share_activity', nudgesEnabled: 'nudges_enabled' };
    const entries = Object.entries(body);
    let user = req.user;
    if (entries.length) {
      const sets = entries.map(([k], i) => `${cols[k]} = $${i + 1}`).join(', ');
      user = await req.db.one(`UPDATE users SET ${sets} WHERE id = $${entries.length + 1} RETURNING *`, [...entries.map(([, v]) => v), req.user.id]);
    }
    res.json({ user: publicUser(user) });
  });

  api.get('/me/export', auth, async (req, res) => {
    const id = req.user.id;
    const meds = await req.db.query('SELECT * FROM medications WHERE user_id = $1 ORDER BY id', [id]);
    const times = await req.db.query('SELECT medication_id, time FROM schedules WHERE medication_id = ANY($1::int[]) ORDER BY time', [meds.map((m) => m.id)]);
    res.setHeader('Content-Disposition', 'attachment; filename="mochi-garden-export.json"');
    res.json({
      exportedAt: new Date().toISOString(),
      user: publicUser(req.user),
      medications: meds.map((m) => ({ ...m, times: times.filter((t) => t.medication_id === m.id).map((t) => t.time) })),
      doseLogs: await req.db.query('SELECT medication_id, date, status, taken_at FROM dose_logs WHERE user_id = $1 ORDER BY taken_at', [id]),
      groups: await req.db.query('SELECT g.name, gm.joined_at FROM group_members gm JOIN community_groups g ON g.id = gm.group_id WHERE gm.user_id = $1', [id]),
    });
  });

  api.delete('/me', auth, async (req, res) => {
    const { password } = z.object({ password: z.string() }).parse(req.body);
    if (!(await bcrypt.compare(password, req.user.password_hash))) throw new HttpError(403, 'That password is incorrect, so your account was not deleted.');
    await req.db.run('DELETE FROM users WHERE id = $1', [req.user.id]);
    clearSession(res);
    res.json({ ok: true });
  });

  // ---------- today / stats ----------
  api.get('/dashboard', auth, async (req, res) => res.json(await dashboard(req.db, req.user)));

  api.get('/history', auth, async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    res.json({ days: await history(req.db, req.user, days) });
  });

  // ---------- medications ----------
  async function medRows(db, meds) {
    const times = meds.length ? await db.query('SELECT medication_id, time FROM schedules WHERE medication_id = ANY($1::int[]) ORDER BY time', [meds.map((m) => m.id)]) : [];
    return meds.map((m) => ({
      id: m.id, name: m.name, dosage: m.dosage, withWater: m.with_water, instructions: m.instructions, notes: m.notes,
      asNeeded: m.as_needed, startDate: m.start_date,
      times: times.filter((t) => t.medication_id === m.id).map((t) => t.time),
    }));
  }
  const medRow = async (db, m) => (await medRows(db, [m]))[0];
  async function ownMed(req) {
    const m = await req.db.one('SELECT * FROM medications WHERE id = $1 AND user_id = $2 AND active', [intId(req.params.id), req.user.id]);
    if (!m) throw notFound('Medication');
    return m;
  }

  api.get('/medications', auth, async (req, res) => {
    const meds = await req.db.query('SELECT * FROM medications WHERE user_id = $1 AND active ORDER BY name', [req.user.id]);
    res.json({ medications: await medRows(req.db, meds) });
  });

  api.post('/medications', auth, async (req, res) => {
    const m = medSchema.parse(req.body);
    const today = localDate(req.user.timezone);
    const med = await req.db.tx(async (t) => {
      const row = await t.one(`INSERT INTO medications (user_id, name, dosage, with_water, instructions, notes, as_needed, start_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`, [req.user.id, m.name, m.dosage, m.withWater, m.instructions, m.notes, m.asNeeded, today]);
      if (!m.asNeeded) for (const time of new Set(m.times)) await t.run('INSERT INTO schedules (medication_id, time) VALUES ($1, $2)', [row.id, time]);
      return row;
    });
    res.status(201).json({ medication: await medRow(req.db, med) });
  });

  api.get('/medications/:id', auth, async (req, res) => res.json({ medication: await medRow(req.db, await ownMed(req)) }));

  api.put('/medications/:id', auth, async (req, res) => {
    const existing = await ownMed(req);
    const m = medSchema.parse(req.body);
    const med = await req.db.tx(async (t) => {
      const row = await t.one('UPDATE medications SET name = $1, dosage = $2, with_water = $3, instructions = $4, notes = $5, as_needed = $6 WHERE id = $7 RETURNING *',
        [m.name, m.dosage, m.withWater, m.instructions, m.notes, m.asNeeded, existing.id]);
      const want = new Set(m.asNeeded ? [] : m.times);
      const have = await t.query('SELECT id, time FROM schedules WHERE medication_id = $1', [existing.id]);
      for (const s of have) if (!want.has(s.time)) await t.run('DELETE FROM schedules WHERE id = $1', [s.id]);
      const haveTimes = new Set(have.map((s) => s.time));
      for (const time of want) if (!haveTimes.has(time)) await t.run('INSERT INTO schedules (medication_id, time) VALUES ($1, $2)', [existing.id, time]);
      return row;
    });
    res.json({ medication: await medRow(req.db, med) });
  });

  api.delete('/medications/:id', auth, async (req, res) => {
    const m = await ownMed(req);
    await req.db.run('UPDATE medications SET active = FALSE WHERE id = $1', [m.id]); // keep history
    res.json({ ok: true });
  });

  api.post('/medications/:id/take', auth, async (req, res) => {
    const m = await ownMed(req);
    if (!m.as_needed) throw new HttpError(400, 'This medication has scheduled times. Check in from today’s doses instead.');
    await req.db.run('INSERT INTO dose_logs (user_id, medication_id, schedule_id, date) VALUES ($1, $2, NULL, $3)', [req.user.id, m.id, localDate(req.user.timezone)]);
    res.json(await dashboard(req.db, req.user));
  });

  // ---------- scheduled doses ----------
  async function ownSchedule(req) {
    const s = await req.db.one(`SELECT s.*, m.name, m.dosage, m.with_water, m.instructions, m.notes FROM schedules s JOIN medications m ON m.id = s.medication_id
      WHERE s.id = $1 AND m.user_id = $2 AND m.active`, [intId(req.params.scheduleId), req.user.id]);
    if (!s) throw notFound('Dose');
    return s;
  }
  const doseDay = (req) => {
    const today = localDate(req.user.timezone);
    const day = req.body?.date || req.query.date || today;
    if (day !== today && day !== addDays(today, -1)) throw new HttpError(400, 'You can only check in for today or yesterday.');
    return day;
  };

  api.get('/doses/:scheduleId', auth, async (req, res) => {
    const s = await ownSchedule(req);
    const day = req.query.date || localDate(req.user.timezone);
    const dose = (await dosesForDay(req.db, req.user, day)).doses.find((d) => d.scheduleId === s.id);
    const last = await req.db.one("SELECT taken_at FROM dose_logs WHERE medication_id = $1 AND status = 'taken' AND date < $2 ORDER BY taken_at DESC LIMIT 1", [s.medication_id, day]);
    res.json({
      dose,
      medication: { id: s.medication_id, name: s.name, dosage: s.dosage, withWater: s.with_water, instructions: s.instructions, notes: s.notes },
      lastTakenAt: iso(last?.taken_at),
    });
  });

  async function recordShareEvents(db, user, day) {
    if (!user.share_activity) return;
    const has = (type) => db.one('SELECT 1 FROM events WHERE user_id = $1 AND type = $2 AND date = $3', [user.id, type, day]);
    const add = (type, value) => db.run('INSERT INTO events (user_id, type, value, date) VALUES ($1, $2, $3, $4)', [user.id, type, value, day]);
    if (!(await has('checkin'))) await add('checkin', 0);
    const { remaining } = await dashboard(db, user);
    if (remaining === 0) {
      const streak = await computeStreak(db, user);
      if ((streak === 3 || (streak >= 7 && streak % 7 === 0)) && !(await has('streak'))) await add('streak', streak);
    }
  }

  api.post('/doses/:scheduleId/take', auth, async (req, res) => {
    const s = await ownSchedule(req);
    const day = doseDay(req);
    const r = await req.db.run(`INSERT INTO dose_logs (user_id, medication_id, schedule_id, date) VALUES ($1, $2, $3, $4)
      ON CONFLICT (schedule_id, date) WHERE schedule_id IS NOT NULL DO NOTHING`, [req.user.id, s.medication_id, s.id, day]);
    if (r.count) await recordShareEvents(req.db, req.user, day);
    res.json(await dashboard(req.db, req.user));
  });

  api.post('/doses/:scheduleId/undo', auth, async (req, res) => {
    const s = await ownSchedule(req);
    await req.db.run('DELETE FROM dose_logs WHERE schedule_id = $1 AND date = $2', [s.id, doseDay(req)]);
    res.json(await dashboard(req.db, req.user));
  });

  api.post('/doses/:scheduleId/snooze', auth, async (req, res) => {
    const s = await ownSchedule(req);
    const { minutes } = z.object({ minutes: z.number().int().min(5).max(180).default(10) }).parse(req.body || {});
    const day = localDate(req.user.timezone);
    const ov = await req.db.one('SELECT time FROM dose_overrides WHERE schedule_id = $1 AND date = $2', [s.id, day]);
    const base = Math.max(localMinutes(req.user.timezone), toMinutes(ov?.time || s.time));
    const until = fromMinutes(Math.min(base + minutes, 23 * 60 + 59));
    await req.db.run(`INSERT INTO dose_overrides (schedule_id, date, snoozed_until) VALUES ($1, $2, $3)
      ON CONFLICT (schedule_id, date) DO UPDATE SET snoozed_until = EXCLUDED.snoozed_until`, [s.id, day, until]);
    res.json(await dashboard(req.db, req.user));
  });

  api.post('/doses/:scheduleId/reschedule', auth, async (req, res) => {
    const s = await ownSchedule(req);
    const { time } = z.object({ time: z.string().regex(TIME_RE, 'Pick a time like 21:30.') }).parse(req.body);
    const day = localDate(req.user.timezone);
    await req.db.run(`INSERT INTO dose_overrides (schedule_id, date, time, snoozed_until) VALUES ($1, $2, $3, NULL)
      ON CONFLICT (schedule_id, date) DO UPDATE SET time = EXCLUDED.time, snoozed_until = NULL`, [s.id, day, time]);
    res.json(await dashboard(req.db, req.user));
  });

  // ---------- community ----------
  const encouragementsThisWeek = async (db) => (await db.one("SELECT COUNT(*)::int AS n FROM cheers WHERE event_id IS NULL AND created_at >= now() - interval '7 days'")).n;

  api.get('/community', auth, async (req, res) => {
    const today = localDate(req.user.timezone);
    const monday = weekStart(today);
    const [week, members, encouragements, neighbours] = await Promise.all([
      req.db.one("SELECT COUNT(*)::int AS n FROM dose_logs WHERE status = 'taken' AND date >= $1", [monday]),
      req.db.one('SELECT COUNT(*)::int AS n FROM users'),
      encouragementsThisWeek(req.db),
      req.db.query(`SELECT u.id, u.name, u.avatar_color, MAX(e.created_at) AS last FROM events e JOIN users u ON u.id = e.user_id
        WHERE u.share_activity AND e.date >= $1 GROUP BY u.id ORDER BY last DESC LIMIT 8`, [addDays(today, -2)]),
    ]);
    res.json({
      weekCheckins: week.n, goal: 1000, members: members.n, encouragements, weekOf: monday,
      neighbours: neighbours.map((u) => ({ id: u.id, name: u.name, avatarColor: u.avatar_color })),
    });
  });

  api.post('/community/encourage', auth, async (req, res) => {
    await req.db.run('INSERT INTO cheers (from_user, event_id) VALUES ($1, NULL)', [req.user.id]);
    res.json({ encouragements: await encouragementsThisWeek(req.db) });
  });

  api.get('/feed', auth, async (req, res) => {
    const groupId = req.query.group ? intId(req.query.group) : null;
    const rows = await req.db.query(`
      SELECT e.id, e.type, e.value, e.created_at, u.id AS user_id, u.name, u.avatar_color,
        (SELECT COUNT(*)::int FROM cheers c WHERE c.event_id = e.id) AS cheers,
        EXISTS (SELECT 1 FROM cheers c WHERE c.event_id = e.id AND c.from_user = $1) AS cheered
      FROM events e JOIN users u ON u.id = e.user_id
      WHERE (u.share_activity OR u.id = $1)
        AND ($2::int IS NULL OR u.id IN (SELECT user_id FROM group_members WHERE group_id = $2))
      ORDER BY e.created_at DESC, e.id DESC LIMIT 40`, [req.user.id, groupId]);
    res.json({
      events: rows.map((r) => ({
        id: r.id, type: r.type, value: r.value, createdAt: iso(r.created_at), cheers: r.cheers, cheered: r.cheered,
        user: { id: r.user_id, name: r.name, avatarColor: r.avatar_color, isMe: r.user_id === req.user.id },
      })),
    });
  });

  api.post('/feed/:id/cheer', auth, async (req, res) => {
    const id = intId(req.params.id);
    if (!(await req.db.one('SELECT 1 FROM events WHERE id = $1', [id]))) throw notFound('Post');
    const removed = await req.db.run('DELETE FROM cheers WHERE event_id = $1 AND from_user = $2', [id, req.user.id]);
    if (!removed.count) await req.db.run('INSERT INTO cheers (from_user, event_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.id, id]);
    const { n } = await req.db.one('SELECT COUNT(*)::int AS n FROM cheers WHERE event_id = $1', [id]);
    res.json({ id, cheers: n, cheered: !removed.count });
  });

  // ---------- groups ----------
  api.get('/groups', auth, async (req, res) => {
    const today = localDate(req.user.timezone);
    const rows = await req.db.query(`
      SELECT g.*, (SELECT COUNT(*)::int FROM group_members gm WHERE gm.group_id = g.id) AS members,
        EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = $1) AS joined,
        (SELECT COUNT(DISTINCT e.user_id)::int FROM events e JOIN group_members gm ON gm.user_id = e.user_id
          WHERE gm.group_id = g.id AND e.type = 'checkin' AND e.date = $2) AS checked_in_today
      FROM community_groups g ORDER BY g.id`, [req.user.id, today]);
    res.json({ groups: rows.map((g) => ({ id: g.id, slug: g.slug, name: g.name, description: g.description, color: g.color, icon: g.icon, members: g.members, joined: g.joined, checkedInToday: g.checked_in_today })) });
  });

  api.post('/groups/:id/join', auth, async (req, res) => {
    const g = await req.db.one('SELECT id FROM community_groups WHERE id = $1', [intId(req.params.id)]);
    if (!g) throw notFound('Group');
    await req.db.run('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [g.id, req.user.id]);
    res.json({ ok: true });
  });

  api.delete('/groups/:id/join', auth, async (req, res) => {
    await req.db.run('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [intId(req.params.id), req.user.id]);
    res.json({ ok: true });
  });

  api.use((req, res) => res.status(404).json({ error: 'That endpoint does not exist.' }));
  app.use('/api', api);

  // ---------- client (local production mode; on Vercel the CDN serves it) ----------
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
