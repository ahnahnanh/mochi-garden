// Postgres access. Uses `pg` when DATABASE_URL (or POSTGRES_URL) is set — e.g. Neon on Vercel —
// and an embedded PGlite database otherwise, so local dev and tests need no Postgres install.
import path from 'node:path';
import fs from 'node:fs';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT 'Taking care, one day at a time',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  avatar_color TEXT NOT NULL DEFAULT '#e2a462',
  share_activity BOOLEAN NOT NULL DEFAULT TRUE,
  nudges_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL DEFAULT '1 tablet',
  with_water BOOLEAN NOT NULL DEFAULT TRUE,
  instructions TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  as_needed BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  start_date TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS medications_user ON medications(user_id);

CREATE TABLE IF NOT EXISTS schedules (
  id SERIAL PRIMARY KEY,
  medication_id INTEGER NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  time TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS schedules_med ON schedules(medication_id);

-- One row per taken (or skipped) dose. schedule_id is NULL for as-needed doses.
CREATE TABLE IF NOT EXISTS dose_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medication_id INTEGER NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  schedule_id INTEGER REFERENCES schedules(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'taken',
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS dose_logs_sched_day ON dose_logs(schedule_id, date) WHERE schedule_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS dose_logs_user_day ON dose_logs(user_id, date);
CREATE INDEX IF NOT EXISTS dose_logs_date ON dose_logs(date);

-- Snoozes and one-day reschedules for a scheduled dose.
CREATE TABLE IF NOT EXISTS dose_overrides (
  schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  time TEXT,
  snoozed_until TEXT,
  PRIMARY KEY (schedule_id, date)
);

CREATE TABLE IF NOT EXISTS community_groups (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id INTEGER NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- Shared activity. Never contains medication names or health details.
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_created ON events(created_at);

CREATE TABLE IF NOT EXISTS cheers (
  id SERIAL PRIMARY KEY,
  from_user INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS cheers_once ON cheers(from_user, event_id) WHERE event_id IS NOT NULL;
`;

export const DEFAULT_GROUPS = [
  { slug: 'general-wellness', name: 'General wellness', description: 'A supportive space for all', color: '#e8f0dc', icon: 'sprout' },
  { slug: 'diabetes-care', name: 'Diabetes care', description: 'Share tips and encouragement', color: '#ece6f4', icon: 'mochi' },
  { slug: 'heart-health', name: 'Heart health', description: 'Daily check-ins together', color: '#f8e1df', icon: 'heart' },
  { slug: 'mental-wellness', name: 'Mental wellness', description: 'Small steps, brighter days', color: '#e3eedb', icon: 'leaf' },
];

/** Uniform helpers over any `(sql, params) => { rows, rowCount|affectedRows }` function. */
function helpers(q) {
  return {
    query: async (sql, params = []) => (await q(sql, params)).rows,
    one: async (sql, params = []) => (await q(sql, params)).rows[0],
    run: async (sql, params = []) => {
      const r = await q(sql, params);
      return { count: r.rowCount ?? r.affectedRows ?? 0, rows: r.rows };
    },
  };
}

async function migrate(db, exec) {
  await exec(SCHEMA);
  for (const g of DEFAULT_GROUPS) {
    await db.run('INSERT INTO community_groups (slug, name, description, color, icon) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (slug) DO NOTHING',
      [g.slug, g.name, g.description, g.color, g.icon]);
  }
}

export function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}

/**
 * Opens a database.
 *   url = 'postgres://…'  → real Postgres via pg
 *   url = 'memory://'     → throwaway in-memory PGlite (tests)
 *   url = ''              → PGlite stored in server/data (local dev)
 */
export async function openDb(url = databaseUrl()) {
  if (url.startsWith('postgres')) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: url, max: Number(process.env.PG_POOL_MAX) || 5 });
    const db = {
      ...helpers((s, p) => pool.query(s, p)),
      async tx(fn) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const out = await fn(helpers((s, p) => client.query(s, p)));
          await client.query('COMMIT');
          return out;
        } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
      },
      close: () => pool.end(),
    };
    await migrate(db, (s) => pool.query(s));
    return db;
  }

  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is not set. Add a Postgres database (for example Neon from the Vercel Storage tab) and redeploy.');
  }
  const { PGlite } = await import('@electric-sql/pglite');
  let dir;
  if (url !== 'memory://') {
    dir = process.env.PGLITE_DIR || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../data/pglite');
    fs.mkdirSync(dir, { recursive: true });
  }
  const pglite = new PGlite(dir);
  const db = {
    ...helpers((s, p) => pglite.query(s, p)),
    tx: (fn) => pglite.transaction((t) => fn(helpers((s, p) => t.query(s, p)))),
    close: () => pglite.close(),
  };
  await migrate(db, (s) => pglite.exec(s));
  return db;
}

let shared;
/** One database per process (or per warm serverless instance). */
export function getDb() {
  if (!shared) shared = openDb().catch((e) => { shared = undefined; throw e; });
  return shared;
}
