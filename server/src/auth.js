import jwt from 'jsonwebtoken';

const COOKIE = 'mochi_session';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function jwtSecret() {
  const s = process.env.JWT_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be set in production');
  return 'dev-only-secret-change-me';
}

export function setSession(res, userId) {
  const token = jwt.sign({ sub: userId }, jwtSecret(), { expiresIn: '30d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

export function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    tagline: u.tagline,
    timezone: u.timezone,
    avatarColor: u.avatar_color,
    shareActivity: !!u.share_activity,
    nudgesEnabled: !!u.nudges_enabled,
    createdAt: u.created_at,
  };
}

/** Attaches req.user, or answers 401. */
export function requireAuth(db) {
  const find = db.prepare('SELECT * FROM users WHERE id = ?');
  return (req, res, next) => {
    const token = req.cookies?.[COOKIE];
    if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
    try {
      const { sub } = jwt.verify(token, jwtSecret());
      const user = find.get(sub);
      if (!user) return res.status(401).json({ error: 'Your account could not be found. Please sign in again.' });
      req.user = user;
      next();
    } catch {
      res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }
  };
}

/** Small in-memory limiter for sign-in attempts. */
export function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now - entry.start > windowMs) hits.set(key, { start: now, count: 1 });
    else if (++entry.count > max) return res.status(429).json({ error: 'Too many attempts. Please wait a minute and try again.' });
    next();
  };
}
