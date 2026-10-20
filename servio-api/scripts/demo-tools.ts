import { execFileSync } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import { basename, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { assertDemoDatabase, assertDisposableDemoDatabase } from '../src/demo/guard';
try { process.loadEnvFile('.env'); } catch {}
const [action,file] = process.argv.slice(2);
const raw = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const url = action === 'backup' ? assertDemoDatabase(raw,process.env.ENVIRONMENT) : assertDisposableDemoDatabase(raw,process.env.ENVIRONMENT);
if (action==='reset' && !['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error('Demo reset currently seeds local R2 only; cloud setup requires owner approval.');
if (!['backup','restore','reset'].includes(action ?? '')) throw new Error('Choose backup, restore or reset.');
const pgEnv = { ...process.env,PGHOST:url.hostname,PGPORT:url.port || '5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:decodeURIComponent(url.pathname.slice(1)),PGSSLMODE:['localhost','127.0.0.1','[::1]'].includes(url.hostname)?'disable':'require' };
const backups=resolve('backups'); await mkdir(backups,{ recursive:true });
const client=new Client({ connectionString:raw,ssl:pgEnv.PGSSLMODE==='disable'?false:{ rejectUnauthorized:true } });
const run=(cmd:string,args:string[],env:NodeJS.ProcessEnv=pgEnv)=>execFileSync(cmd,args,{ env,stdio:'inherit' });
try {
  await client.connect();
  if (action!=='backup') {
    const found=await client.query("SELECT to_regclass('public.users') AS users");
    if (found.rows[0].users) {
      const real=await client.query('SELECT 1 FROM users WHERE NOT is_demo LIMIT 1');
      if (real.rowCount) throw new Error('Refusing to destroy non-demo accounts. Use a separate empty servio_demo database.');
    }
  }
  if (action==='restore') {
    const path=resolve(file ?? '');
    if (!path.startsWith(backups+sep) || !path.endsWith('.dump') || !(await stat(path)).isFile()) throw new Error('Choose a .dump file in servio-api/backups.');
    run('pg_restore',['--clean','--if-exists','--no-owner','--no-privileges','--single-transaction',`--dbname=${pgEnv.PGDATABASE}`,path]);
    console.log(`Restored ${basename(path)} → ${pgEnv.PGDATABASE}`);
  } else if (action==='backup') {
    const path=resolve(backups,`servio-${pgEnv.PGDATABASE}-${new Date().toISOString().replace(/[:.]/g,'-')}.dump`);
    run('pg_dump',['--format=custom','--no-owner','--no-privileges','--file',path]);
    console.log(`Backup: ${path}`);
  } else {
    const childEnv={ ...process.env,DATABASE_URL:raw!,DATABASE_URL_UNPOOLED:raw! };
    run(process.execPath,[fileURLToPath(new URL('../node_modules/drizzle-kit/bin.cjs',import.meta.url).href),'migrate'],childEnv);
    await client.query('BEGIN');
    try {
      await client.query('LOCK TABLE users,bookings,bulletin_requests IN ACCESS EXCLUSIVE MODE');
      const real=await client.query('SELECT 1 FROM users WHERE NOT is_demo UNION ALL SELECT 1 FROM bookings WHERE NOT is_demo UNION ALL SELECT 1 FROM bulletin_requests WHERE NOT is_demo LIMIT 1');
      if (real.rowCount) throw new Error('Refusing to truncate non-demo rows.');
      await client.query('TRUNCATE notifications,support_requests,sessions,login_codes,uploads,user_addresses,addon_quotes,dispatch_offers,messages,reviews,ledger_entries,payouts,booking_events,bookings,bulletin_requests,pro_skus,pro_profiles,users');
      await client.query("ALTER SEQUENCE booking_code_seq RESTART WITH 8800");
      await client.query('COMMIT');
    } catch(error) { await client.query('ROLLBACK'); throw error; }
    run(process.execPath,[fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs',import.meta.url).href),'scripts/seed-demo.ts'],childEnv);
  }
} finally { await client.end(); }
