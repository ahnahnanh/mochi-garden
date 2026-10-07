// Fills the database with a demo account plus a small community.
// Usage:  npm run seed                (local database; refuses if it already has users)
//         npm run seed -- --reset     (wipes all users first)
// Against Neon/Vercel Postgres: DATABASE_URL=postgres://... npm run seed
import bcrypt from 'bcryptjs';
import { openDb } from './db.js';
import { localDate, localMinutes, addDays, toMinutes, weekStart } from './time.js';

export const DEMO = { email: 'anh@mochi.garden', password: 'mochigarden', timezone: 'Asia/Singapore' };

export async function seed(db, { reset = false } = {}) {
  const { n } = await db.one('SELECT COUNT(*)::int AS n FROM users');
  if (n > 0 && !reset) throw new Error(`The database already has ${n} users. Run with --reset to wipe them and reseed.`);

  let s = 42; // deterministic pseudo-random so every seed looks the same
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const hash = await bcrypt.hash(DEMO.password, 10);
  const otherHash = await bcrypt.hash(`community-${Math.random()}`, 4); // these accounts can't be signed into

  await db.tx(async (t) => {
    await t.run('DELETE FROM users');
    const addUser = async (name, email, tz, color, pwd = otherHash) =>
      (await t.one('INSERT INTO users (name, email, password_hash, timezone, avatar_color) VALUES ($1, $2, $3, $4, $5) RETURNING id', [name, email, pwd, tz, color])).id;
    const addMed = async (userId, name, start, { times = [], asNeeded = false, instructions = '', notes = '' } = {}) => {
      const id = (await t.one('INSERT INTO medications (user_id, name, instructions, notes, as_needed, start_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [userId, name, instructions, notes, asNeeded, start])).id;
      const sched = [];
      for (const time of times) sched.push({ id: (await t.one('INSERT INTO schedules (medication_id, time) VALUES ($1, $2) RETURNING id', [id, time])).id, time });
      return { id, sched };
    };
    const logs = [];
    const log = (u, m, sc, day, ago) => logs.push([u, m, sc, day, ago]);
    const join = (slug, userId) => t.run('INSERT INTO group_members (group_id, user_id) SELECT id, $2 FROM community_groups WHERE slug = $1 ON CONFLICT DO NOTHING', [slug, userId]);

    // ---- demo user: Anh ----
    const tz = DEMO.timezone;
    const today = localDate(tz);
    const nowMin = localMinutes(tz);
    const anh = await addUser('Anh', DEMO.email, tz, '#e2a462', hash);
    const start = addDays(today, -40);
    const medA = await addMed(anh, 'Medication A', start, { times: ['08:00', '20:00'], instructions: 'After meals', notes: 'Prescribed by Dr. Lim. Refill every 30 days.' });
    const medB = await addMed(anh, 'Medication B', start, { times: ['13:00'], instructions: 'With lunch' });
    await addMed(anh, 'Medication C', start, { asNeeded: true, instructions: 'Only when needed, max 2 a day' });
    const all = [...medA.sched.map((x) => ({ ...x, med: medA.id })), ...medB.sched.map((x) => ({ ...x, med: medB.id }))];
    for (let i = 40; i >= 1; i--) {
      for (const d of all) {
        const missed = i > 12 && (i === 13 ? d.time === '13:00' : rand() < 0.12);
        if (!missed) log(anh, d.med, d.id, addDays(today, -i), `-${i} days`);
      }
    }
    for (const d of all) if (toMinutes(d.time) + 5 <= nowMin && d.time !== '20:00') log(anh, d.med, d.id, today, '-0 minutes');
    await join('general-wellness', anh);

    // ---- community ----
    const named = [
      ['Sunny', '#c9b8e8', 'checkin', 0, '-2 minutes'],
      ['Leafy', '#9cc47a', 'streak', 7, '-15 minutes'],
      ['Momo', '#b07a48', 'checkin', 0, '-1 hours'],
      ['Kai', '#8fb3d9', 'streak', 14, '-2 hours'],
      ['Lily', '#f2b8a0', 'checkin', 0, '-3 hours'],
    ];
    const groups = ['general-wellness', 'diabetes-care', 'heart-health', 'mental-wellness'];
    const colors = ['#e2a462', '#c0874c', '#f2cf55', '#a5754a', '#d9a6c9', '#9cc47a', '#8fb3d9', '#f3eee6', '#3d3a3c'];
    const monday = weekStart(today);
    const people = [...named.map(([n, c]) => [n, c])];
    for (let i = 0; i < 60; i++) people.push([`Gardener ${i + 1}`, colors[i % colors.length]]);
    const ids = {};
    for (const [idx, [name, color]] of people.entries()) {
      const id = await addUser(name, `${name.toLowerCase().replace(/\s+/g, '')}@example.com`, tz, color);
      ids[name] = id;
      const med = await addMed(id, 'Daily routine', addDays(today, -30), { times: ['08:00', '14:00', '21:00'] });
      for (let d = monday; d <= today; d = addDays(d, 1)) {
        for (const sc of med.sched) if (rand() < 0.88 && (d < today || toMinutes(sc.time) <= nowMin)) log(id, med.id, sc.id, d, '-1 hours');
      }
      for (const g of groups) if (idx < 5 || rand() < 0.35) await join(g, id);
    }

    // bulk insert logs in chunks
    for (let i = 0; i < logs.length; i += 500) {
      const chunk = logs.slice(i, i + 500);
      const values = chunk.map((_, j) => `($${j * 5 + 1}, $${j * 5 + 2}, $${j * 5 + 3}, $${j * 5 + 4}, now() + $${j * 5 + 5}::interval)`).join(', ');
      await t.run(`INSERT INTO dose_logs (user_id, medication_id, schedule_id, date, taken_at) VALUES ${values} ON CONFLICT DO NOTHING`, chunk.flat());
    }

    const event = (u, type, value, ago) => t.run("INSERT INTO events (user_id, type, value, date, created_at) VALUES ($1, $2, $3, $4, now() + $5::interval)", [u, type, value, today, ago]);
    for (const [name, , type, value, ago] of named) await event(ids[name], type, value, ago);
    for (let i = 0; i < 6; i++) await event(ids[`Gardener ${i + 1}`], 'checkin', 0, `-${4 + i} hours`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const db = await openDb();
  try {
    await seed(db, { reset: process.argv.includes('--reset') });
    console.log(`Seeded. Sign in with ${DEMO.email} / ${DEMO.password}`);
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}
