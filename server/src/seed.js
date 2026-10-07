// Resets the database and fills it with a demo account plus a small community.
// Usage: npm run seed
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { openDb } from './db.js';
import { localDate, localMinutes, addDays, toMinutes, weekStart } from './time.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const db = openDb(process.env.DATABASE_FILE || path.resolve(here, '../data/mochi.db'));

// Deterministic pseudo-random so every seed looks the same.
let s = 42;
const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);

export const DEMO = { email: 'anh@mochi.garden', password: 'mochigarden', timezone: 'Asia/Singapore' };

db.transaction(() => {
  db.exec('DELETE FROM users; DELETE FROM cheers; DELETE FROM events;');
  const hash = bcrypt.hashSync(DEMO.password, 10);
  const otherHash = bcrypt.hashSync('community-member', 4);

  const addUser = (name, email, tz, color, pwd = otherHash) =>
    db.prepare('INSERT INTO users (name, email, password_hash, timezone, avatar_color) VALUES (?, ?, ?, ?, ?)').run(name, email, pwd, tz, color).lastInsertRowid;
  const addMed = (userId, name, start, { times = [], asNeeded = false, dosage = '1 tablet', instructions = '', notes = '' } = {}) => {
    const id = db.prepare('INSERT INTO medications (user_id, name, dosage, instructions, notes, as_needed, start_date) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(userId, name, dosage, instructions, notes, Number(asNeeded), start).lastInsertRowid;
    const sched = times.map((t) => ({ id: db.prepare('INSERT INTO schedules (medication_id, time) VALUES (?, ?)').run(id, t).lastInsertRowid, time: t }));
    return { id, sched };
  };
  const log = db.prepare("INSERT OR IGNORE INTO dose_logs (user_id, medication_id, schedule_id, date, taken_at) VALUES (?, ?, ?, ?, datetime('now', ?))");
  const event = db.prepare("INSERT INTO events (user_id, type, value, date, created_at) VALUES (?, ?, ?, ?, datetime('now', ?))");
  const join = db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES ((SELECT id FROM groups WHERE slug = ?), ?)');

  // ---- demo user: Anh ----
  const tz = DEMO.timezone;
  const today = localDate(tz);
  const nowMin = localMinutes(tz);
  const anh = addUser('Anh', DEMO.email, tz, '#e2a462', hash);
  const start = addDays(today, -40);
  const medA = addMed(anh, 'Medication A', start, { times: ['08:00', '20:00'], instructions: 'After meals', notes: 'Prescribed by Dr. Lim. Refill every 30 days.' });
  const medB = addMed(anh, 'Medication B', start, { times: ['13:00'], instructions: 'With lunch' });
  addMed(anh, 'Medication C', start, { asNeeded: true, instructions: 'Only when needed, max 2 a day' });
  const all = [...medA.sched.map((x) => ({ ...x, med: medA.id })), ...medB.sched.map((x) => ({ ...x, med: medB.id }))];
  for (let i = 40; i >= 1; i--) {
    const day = addDays(today, -i);
    for (const d of all) {
      const missed = i > 12 && (i === 13 ? d.time === '13:00' : rand() < 0.12);
      if (!missed) log.run(anh, d.med, d.id, day, `-${i} days`);
    }
  }
  for (const d of all) if (toMinutes(d.time) + 5 <= nowMin && d.time !== '20:00') log.run(anh, d.med, d.id, today, '-0 minutes');
  join.run('general-wellness', anh);

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
  const people = named.map(([n, c]) => [n, c]);
  for (let i = 0; i < 60; i++) people.push([`Gardener ${i + 1}`, colors[i % colors.length]]);

  people.forEach(([name, color], idx) => {
    const id = addUser(name, `${name.toLowerCase().replace(/\s+/g, '')}@example.com`, tz, color);
    const med = addMed(id, 'Daily routine', addDays(today, -30), { times: ['08:00', '14:00', '21:00'] });
    for (let d = monday; d <= today; d = addDays(d, 1)) {
      for (const sc of med.sched) if (rand() < 0.88 && (d < today || toMinutes(sc.time) <= nowMin)) log.run(id, med.id, sc.id, d, '-1 hours');
    }
    for (const g of groups) if (idx < 5 || rand() < 0.35) join.run(g, id);
  });

  // Feed posts for the named neighbours, newest first.
  const ids = db.prepare('SELECT id, name FROM users').all();
  for (const [n, , type, value, ago] of named) event.run(ids.find((u) => u.name === n).id, type, value, today, ago);
  for (let i = 0; i < 6; i++) event.run(ids.find((u) => u.name === `Gardener ${i + 1}`).id, 'checkin', 0, today, `-${4 + i} hours`);
})();

console.log(`Seeded. Sign in with ${DEMO.email} / ${DEMO.password}`);
