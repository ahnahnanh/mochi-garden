import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { computeStreak } from '../src/logic.js';
import { localDate, addDays } from '../src/time.js';

function setup() {
  const db = openDb(':memory:');
  return { db, app: createApp(db) };
}

async function signUp(app, email = 'anh@test.dev', timezone = 'Asia/Singapore') {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({ name: 'Anh', email, password: 'password123', timezone });
  assert.equal(res.status, 201);
  return agent;
}

test('protected routes require a session', async () => {
  const { app } = setup();
  const res = await request(app).get('/api/dashboard');
  assert.equal(res.status, 401);
  assert.match(res.body.error, /sign in/i);
});

test('register, sign out, sign back in', async () => {
  const { app } = setup();
  const agent = await signUp(app);
  assert.equal((await agent.get('/api/me')).body.user.name, 'Anh');
  await agent.post('/api/auth/logout');
  assert.equal((await agent.get('/api/me')).status, 401);
  const bad = await agent.post('/api/auth/login').send({ email: 'anh@test.dev', password: 'nope' });
  assert.equal(bad.status, 401);
  const ok = await agent.post('/api/auth/login').send({ email: 'ANH@test.dev', password: 'password123' });
  assert.equal(ok.status, 200);
  const dup = await request(app).post('/api/auth/register').send({ name: 'X', email: 'anh@test.dev', password: 'password123' });
  assert.equal(dup.status, 409);
});

test('validation errors are readable', async () => {
  const { app } = setup();
  const agent = await signUp(app);
  const res = await agent.post('/api/medications').send({ name: 'Vitamin D' });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /reminder time/);
});

test('medication check-in flow updates the dashboard', async () => {
  const { app } = setup();
  const agent = await signUp(app);
  const med = (await agent.post('/api/medications').send({ name: 'Medication A', times: ['00:00', '23:59'] })).body.medication;
  assert.deepEqual(med.times, ['00:00', '23:59']);

  let dash = (await agent.get('/api/dashboard')).body;
  assert.equal(dash.doses.length, 2);
  assert.equal(dash.remaining, 2);
  assert.equal(dash.streak, 0);

  for (const d of dash.doses) dash = (await agent.post(`/api/doses/${d.scheduleId}/take`)).body;
  assert.equal(dash.remaining, 0);
  assert.equal(dash.streak, 1);
  assert.equal(dash.garden.plants, 2);

  // taking twice does nothing
  dash = (await agent.post(`/api/doses/${dash.doses[0].scheduleId}/take`)).body;
  assert.equal(dash.garden.plants, 2);

  dash = (await agent.post(`/api/doses/${dash.doses[0].scheduleId}/undo`)).body;
  assert.equal(dash.remaining, 1);
  assert.equal(dash.streak, 0);
});

test('snooze and reschedule apply to today only', async () => {
  const { app } = setup();
  const agent = await signUp(app, 'a@b.dev', 'UTC');
  const med = (await agent.post('/api/medications').send({ name: 'M', times: ['23:50'] })).body.medication;
  const sid = (await agent.get('/api/dashboard')).body.doses[0].scheduleId;
  let dash = (await agent.post(`/api/doses/${sid}/reschedule`).send({ time: '21:30' })).body;
  assert.equal(dash.doses[0].time, '21:30');
  dash = (await agent.post(`/api/doses/${sid}/snooze`).send({ minutes: 10 })).body;
  assert.ok(dash.doses[0].snoozedUntil);
  assert.deepEqual((await agent.get(`/api/medications/${med.id}`)).body.medication.times, ['23:50']);
});

test('streak counts consecutive complete days and ignores an unfinished today', () => {
  const db = openDb(':memory:');
  const tz = 'UTC';
  const today = localDate(tz);
  const uid = db.prepare("INSERT INTO users (name, email, password_hash, timezone) VALUES ('T', 't@t', 'x', ?)").run(tz).lastInsertRowid;
  const mid = db.prepare('INSERT INTO medications (user_id, name, start_date) VALUES (?, ?, ?)').run(uid, 'M', addDays(today, -10)).lastInsertRowid;
  const sid = db.prepare("INSERT INTO schedules (medication_id, time) VALUES (?, '23:59')").run(mid).lastInsertRowid;
  const take = (n) => db.prepare('INSERT INTO dose_logs (user_id, medication_id, schedule_id, date) VALUES (?, ?, ?, ?)').run(uid, mid, sid, addDays(today, -n));
  [1, 2, 3, 5, 6].forEach(take); // day 4 missed
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
  assert.equal(computeStreak(db, user), 3);
  take(0);
  assert.equal(computeStreak(db, user), 4);
});

test('users cannot touch each other’s doses', async () => {
  const { app } = setup();
  const a = await signUp(app, 'a@x.dev');
  const b = await signUp(app, 'b@x.dev');
  await a.post('/api/medications').send({ name: 'Private', times: ['09:00'] });
  const sid = (await a.get('/api/dashboard')).body.doses[0].scheduleId;
  assert.equal((await b.post(`/api/doses/${sid}/take`)).status, 404);
  assert.equal((await b.get(`/api/doses/${sid}`)).status, 404);
});

test('community feed never exposes medication names', async () => {
  const { app } = setup();
  const a = await signUp(app, 'a@x.dev');
  await a.post('/api/medications').send({ name: 'Secret Pill 20mg', times: ['00:00'] });
  const sid = (await a.get('/api/dashboard')).body.doses[0].scheduleId;
  await a.post(`/api/doses/${sid}/take`);
  const b = await signUp(app, 'b@x.dev');
  const feed = (await b.get('/api/feed')).body;
  assert.ok(feed.events.length >= 1);
  assert.doesNotMatch(JSON.stringify(feed), /Secret Pill/);
  const cheer = await b.post(`/api/feed/${feed.events[0].id}/cheer`);
  assert.equal(cheer.body.cheers, 1);
  const community = (await b.get('/api/community')).body;
  assert.equal(community.weekCheckins, 1);
});

test('turning off sharing keeps check-ins out of the feed', async () => {
  const { app } = setup();
  const a = await signUp(app, 'a@x.dev');
  await a.patch('/api/me').send({ shareActivity: false });
  await a.post('/api/medications').send({ name: 'M', times: ['00:00'] });
  const sid = (await a.get('/api/dashboard')).body.doses[0].scheduleId;
  await a.post(`/api/doses/${sid}/take`);
  const b = await signUp(app, 'b@x.dev');
  assert.equal((await b.get('/api/feed')).body.events.length, 0);
});

test('groups: join and leave', async () => {
  const { app } = setup();
  const a = await signUp(app);
  let groups = (await a.get('/api/groups')).body.groups;
  assert.equal(groups.length, 4);
  assert.ok(groups.find((g) => g.slug === 'general-wellness').joined);
  const heart = groups.find((g) => g.slug === 'heart-health');
  await a.post(`/api/groups/${heart.id}/join`);
  groups = (await a.get('/api/groups')).body.groups;
  assert.equal(groups.find((g) => g.id === heart.id).members, 1);
  await a.delete(`/api/groups/${heart.id}/join`);
  groups = (await a.get('/api/groups')).body.groups;
  assert.equal(groups.find((g) => g.id === heart.id).joined, false);
});

test('account deletion needs the password', async () => {
  const { app } = setup();
  const a = await signUp(app);
  assert.equal((await a.delete('/api/me').send({ password: 'wrong' })).status, 403);
  assert.equal((await a.delete('/api/me').send({ password: 'password123' })).status, 200);
  assert.equal((await a.get('/api/me')).status, 401);
});
