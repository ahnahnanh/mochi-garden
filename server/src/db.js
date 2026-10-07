import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT 'Taking care, one day at a time',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  avatar_color TEXT NOT NULL DEFAULT '#e2a462',
  share_activity INTEGER NOT NULL DEFAULT 1,
  nudges_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS medications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL DEFAULT '1 tablet',
  with_water INTEGER NOT NULL DEFAULT 1,
  instructions TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  as_needed INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  start_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY,
  medication_id INTEGER NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  time TEXT NOT NULL
);

-- One row per taken (or skipped) dose. schedule_id is NULL for as-needed doses.
CREATE TABLE IF NOT EXISTS dose_logs (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medication_id INTEGER NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  schedule_id INTEGER REFERENCES schedules(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'taken',
  taken_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS dose_logs_sched_day ON dose_logs(schedule_id, date) WHERE schedule_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS dose_logs_user_day ON dose_logs(user_id, date);
CREATE INDEX IF NOT EXISTS dose_logs_taken_at ON dose_logs(taken_at);

-- Snoozes and one-day reschedules for a scheduled dose.
CREATE TABLE IF NOT EXISTS dose_overrides (
  schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  time TEXT,
  snoozed_until TEXT,
  PRIMARY KEY (schedule_id, date)
);

CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (group_id, user_id)
);

-- Shared activity. Never contains medication names or health details.
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS events_created ON events(created_at);

CREATE TABLE IF NOT EXISTS cheers (
  id INTEGER PRIMARY KEY,
  from_user INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS cheers_once ON cheers(from_user, event_id) WHERE event_id IS NOT NULL;
`;

export const DEFAULT_GROUPS = [
  { slug: 'general-wellness', name: 'General wellness', description: 'A supportive space for all', color: '#e8f0dc', icon: 'sprout' },
  { slug: 'diabetes-care', name: 'Diabetes care', description: 'Share tips and encouragement', color: '#ece6f4', icon: 'mochi' },
  { slug: 'heart-health', name: 'Heart health', description: 'Daily check-ins together', color: '#f8e1df', icon: 'heart' },
  { slug: 'mental-wellness', name: 'Mental wellness', description: 'Small steps, brighter days', color: '#e3eedb', icon: 'leaf' },
];

export function openDb(file = process.env.DATABASE_FILE || path.resolve('data/mochi.db')) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  const insert = db.prepare('INSERT OR IGNORE INTO groups (slug, name, description, color, icon) VALUES (@slug, @name, @description, @color, @icon)');
  for (const g of DEFAULT_GROUPS) insert.run(g);
  return db;
}
