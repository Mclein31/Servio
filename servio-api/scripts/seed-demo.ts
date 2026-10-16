/** Guarded, idempotent local presentation dataset. Does not reset an ongoing run. */
import { execFileSync } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../src/db/schema';
import { assertDemoDatabase } from '../src/demo/guard';
import { DEMO_IMAGES } from '../src/demo/data';
import { seedDemo } from '../src/demo/seed';

try { process.loadEnvFile('.env'); } catch { /* Exported environment is also supported. */ }
const raw = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const url = assertDemoDatabase(raw,process.env.ENVIRONMENT);
if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname) || (process.env.UPLOADS_MODE ?? 'local') !== 'local') {
  throw new Error('This demo uses local Wrangler R2. Cloud seeding requires the owner-approved SERVIO deployment first.');
}
const bucket = process.env.R2_BUCKET_NAME || 'servio-uploads-dev';
if (!/^servio-[a-z0-9-]+$/.test(bucket)) throw new Error('Use a dedicated servio-* bucket.');
const client = new Client({ connectionString: raw, ssl: false });
try {
  // Validate the DB connection before touching the local bucket.
  await client.connect();
  await import('./seed');
  const lengths: Record<string,number> = {};
  for (const image of DEMO_IMAGES) {
    const file = fileURLToPath(new URL(`../../servio-app/src/assets/${image.file}`,import.meta.url).href);
    lengths[image.key] = (await stat(file)).size;
    execFileSync(process.execPath,[fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url).href), 'r2','object','put',`${bucket}/${image.key}`,'--local','--file',file,'--content-type','image/png'],{ stdio: ['ignore','pipe','pipe'] });
  }
  const result = await seedDemo(drizzle(client,{ schema }),lengths);
  console.log(`${result.created ? 'Created' : 'Kept existing'} SERVIO demo: ${result.users} accounts, ${result.bookings} bookings, ${result.bulletin} bulletin posts; ${DEMO_IMAGES.length} local images. ${url.hostname}${url.pathname}`);
} finally { await client.end(); }
