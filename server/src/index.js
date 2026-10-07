// Local / self-hosted server. On Vercel, api/index.js is used instead.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from './db.js';
import { createApp } from './app.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = createApp(getDb, { clientDir: path.resolve(here, '../../client/dist') });

await getDb(); // fail fast if the database can't be opened
const port = Number(process.env.PORT) || 3001;
app.listen(port, () => console.log(`Mochi Garden API listening on http://localhost:${port}`));
