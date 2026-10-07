# Mochi Garden

Gentle medication check-ins that help Mochi's garden grow. Every dose you take plants something; every fully completed day makes a flower bloom and extends your streak. An optional community garden lets people cheer each other on without ever sharing medication names or health details.

**Stack:** Node.js + Express API · SQLite (better-sqlite3) · React 19 + Vite · cookie-based JWT sessions.

## Quick start

Requires Node.js 20 or newer.

```bash
npm install          # root tools (concurrently)
npm run setup        # installs server and client dependencies
npm run seed         # creates a demo account and a small community
npm run dev          # API on :3001, web app on http://localhost:5173
```

Sign in with the demo account: **anh@mochi.garden** / **mochigarden**, or create your own account.

### Production

```bash
npm run build        # builds the React app into client/dist
JWT_SECRET=change-me NODE_ENV=production npm start
```

The Express server serves the built app and the API from one port (`PORT`, default 3001).

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | HTTP port |
| `JWT_SECRET` | dev-only value | Signs session cookies. **Required** when `NODE_ENV=production`. |
| `DATABASE_FILE` | `server/data/mochi.db` | SQLite file location |
| `NODE_ENV` | — | `production` enables secure cookies |

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
server/
  src/db.js        schema + default groups
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
npm test
```

Covers auth, validation, the check-in flow, snooze/reschedule, streak rules, cross-account access, feed privacy, groups and account deletion.

## Not medical advice

Mochi Garden is a reminder and motivation tool. Always follow the instructions of your doctor or pharmacist.
