// Vercel Function: the whole Express API. vercel.json rewrites /api/* here;
// the built React app in client/dist is served by Vercel's CDN.
import { getDb } from '../server/src/db.js';
import { createApp } from '../server/src/app.js';

export default createApp(getDb);
