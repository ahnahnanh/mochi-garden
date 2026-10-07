import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

const COOKIE = 'mochi_session';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const cachedSecret = new WeakMap(); // per database
/**
 * The key that signs session cookies. JWT_SECRET wins if set; otherwise a random key is
 * generated once and stored in the database, so every server instance shares it.
 */
export async function jwtSecret(db) {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (cachedSecret.has(db)) return cachedSecret.get(db);
  await db.run("INSERT INTO app_settings (key, value) VALUES ('jwt_secret', $1) ON CONFLICT (key) DO NOTHING", [crypto.randomBytes(48).toString('base64url')]);
  const { value } = await db.one("SELECT value FROM app_settings WHERE key = 'jwt_secret'");
  cachedSecret.set(db, value);
  return value;
}

export async function setSession(req, res, userId) {
  const token = jwt.sign({ sub: userId }, await jwtSecret(req.db), { expiresIn: '30d' });
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
    createdAt: u.created_at instanceof Date ? u.created_at.toISOString() : u.created_at,
  };
}

/** Attaches req.user, or answers 401. Expects req.db. */
export async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
  const secret = await jwtSecret(req.db);
  let sub;
  try { ({ sub } = jwt.verify(token, secret)); } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
  const user = await req.db.one('SELECT * FROM users WHERE id = $1', [sub]);
  if (!user) return res.status(401).json({ error: 'Your account could not be found. Please sign in again.' });
  req.user = user;
  next();
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
