// Server entry. On Vercel (services mode) this module's default export is the Express app;
// everywhere else it also listens on PORT and serves the built client.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from './db.js';
import { createApp } from './app.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = createApp(getDb, { clientDir: process.env.VERCEL ? undefined : path.resolve(here, '../../client/dist') });

if (!process.env.VERCEL) {
  await getDb(); // fail fast locally if the database can't be opened
  const port = Number(process.env.PORT) || 3001;
  app.listen(port, () => console.log(`Mochi Garden API listening on http://localhost:${port}`));
}

export default app;
