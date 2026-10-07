# Mochi Garden

Gentle medication check-ins that help Mochi's garden grow. Every dose you take plants something; every fully completed day makes a flower bloom and extends your streak. An optional community garden lets people cheer each other on without ever sharing medication names or health details.

**Stack:** Node.js + Express API · Postgres · React 19 + Vite · cookie-based JWT sessions. Deploys to Vercel (static app on the CDN, API as one Vercel Function, database on Neon).

## Deploy to Vercel

1. **Import the repo.** In Vercel, choose *Add New → Project* and import `mochi-garden`. Leave the framework preset as *Other*; `vercel.json` already sets the install, build and output settings.
2. **Add a database.** In the project, open *Storage → Create Database → Neon (Postgres)* and connect it to the project. Pick the **Singapore** region, since the API runs in Singapore (`sin1` in `vercel.json`). This sets `DATABASE_URL` for you. Tables are created automatically on the first request.
3. **Add a session secret.** Under *Settings → Environment Variables*, add `JWT_SECRET` with a long random value, for example the output of `openssl rand -base64 32`.
4. **Deploy** (or redeploy if the first build ran before steps 2 and 3). Check `https://<your-app>.vercel.app/api/health` returns `{"ok":true}`.
5. **Optional demo data.** From your computer, copy the database URL from the Neon integration and run:
   ```bash
   DATABASE_URL="postgres://…" npm run seed
   ```
   This refuses to run if the database already has accounts. Add `-- --reset` to wipe everything first, which also deletes real accounts.

If `DATABASE_URL` or `JWT_SECRET` is missing, the API answers with a message saying which one to add.

## Run locally

Requires Node.js 20 or newer. No Postgres install needed: without `DATABASE_URL`, the server uses an embedded Postgres (PGlite) stored in `server/data/`.

```bash
npm install          # root tools
npm run setup        # installs server and client dependencies
npm run seed         # creates a demo account and a small community
npm run dev          # API on :3001, web app on http://localhost:5173
```

Sign in with the demo account: **anh@mochi.garden** / **mochigarden**, or create your own account.

To run the whole thing as one server (for example on a VPS):

```bash
npm run build
DATABASE_URL=postgres://… JWT_SECRET=change-me NODE_ENV=production npm start
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` (or `POSTGRES_URL`) | embedded PGlite | Postgres connection string. **Required** on Vercel/production. |
| `JWT_SECRET` | dev-only value | Signs session cookies. **Required** in production. |
| `PORT` | `3001` | HTTP port for `npm start` |
| `PG_POOL_MAX` | `5` | Max Postgres connections per server instance |

## Features

- **Accounts** — sign up, sign in, sign out, edit name/tagline/Mochi's colour, time zone, download your data (JSON), delete your account.
- **Medications** — name, amount, how to take it, notes, any number of daily reminder times, or "as needed" (never counts against you).
- **Today** — each dose shows upcoming / due / overdue / taken. Mark as taken, undo, snooze 10 minutes, or reschedule just today's dose.
- **In-app nudge** — opening the app with an overdue dose shows Mochi's check-in prompt (can be turned off in Settings).
- **Streaks & stats** — consecutive fully-completed days (an unfinished today never breaks it), last-7-days and this-month adherence.
- **My Garden** — grows with total check-ins; flowers for complete days; growth stages at 3, 7 and 14-day streaks; 4-week calendar.
- **Community** — feed of check-ins and streak milestones with cheers, a shared weekly goal (1,000 check-ins), "send encouragement", and opt-in groups. Sharing can be turned off entirely.

## Project layout

```
api/index.js       Vercel Function entry (wraps the Express app)
vercel.json        install/build settings and /api rewrites
server/
  src/db.js        Postgres schema, pg / PGlite connection
  src/logic.js     dose status, streaks, stats, garden
  src/time.js      time-zone-aware day helpers
  src/app.js       REST API
  src/seed.js      demo data
  test/            API tests (node --test)
client/
  src/art.jsx      SVG Mochi, plants and scenes
  src/pages/       Home, Dose, Garden, Community, Profile, Settings, Medications, Help
```

## API overview

All routes are under `/api` and use the session cookie.

| Method & path | What it does |
| --- | --- |
| `POST /auth/register`, `/auth/login`, `/auth/logout` | Account sessions |
| `GET /me`, `PATCH /me`, `GET /me/export`, `DELETE /me` | Profile, settings, data export, deletion |
| `GET /dashboard` | Today's doses, streak, stats, garden |
| `GET /history?days=28` | Per-day completion |
| `GET/POST /medications`, `GET/PUT/DELETE /medications/:id` | Manage medications |
| `POST /medications/:id/take` | Log an as-needed dose |
| `GET /doses/:scheduleId` | Dose detail |
| `POST /doses/:scheduleId/take` · `/undo` · `/snooze` · `/reschedule` | Check-in actions |
| `GET /community`, `POST /community/encourage` | Shared garden progress |
| `GET /feed?group=ID`, `POST /feed/:id/cheer` | Community feed |
| `GET /groups`, `POST/DELETE /groups/:id/join` | Groups |

## Privacy

Community features only ever see a person's display name, Mochi's colour, that they checked in, and streak milestones. Medication names, doses, times and notes stay private to the account owner. Turning off "Share check-ins" removes a person from the feed.

## Tests

```bash
npm test                                             # embedded Postgres
TEST_DATABASE_URL=postgres://… npm test              # a real Postgres (wiped before each test!)
```

Covers auth, validation, the check-in flow, snooze/reschedule, streak rules, cross-account access, feed privacy, groups and account deletion.

## Not medical advice

Mochi Garden is a reminder and motivation tool. Always follow the instructions of your doctor or pharmacist.
