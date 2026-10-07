import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { createApp } from './app.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const db = openDb(process.env.DATABASE_FILE || path.resolve(here, '../data/mochi.db'));
const app = createApp(db, { clientDir: path.resolve(here, '../../client/dist') });

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => console.log(`Mochi Garden API listening on http://localhost:${port}`));
