// production secrets setup
import { spawnSync } from 'node:child_process';

try {
  process.loadEnvFile('.env');
} catch {
}

const SECRETS = [
  'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY',
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'MAIL_FROM', 'MAIL_FROM_NAME',
  'PIN_SECRET',
] as const;

const values = Object.fromEntries(SECRETS.map((name) => [name, process.env[`PROD_${name}`]?.trim() ?? '']));
const missing = SECRETS.filter((name) => !values[name]);
for (const name of SECRETS) console.log(`${values[name] ? 'filled ' : 'MISSING'}  PROD_${name}`);

if (process.argv.includes('--check')) process.exit(missing.length ? 1 : 0);
if (missing.length) {
  console.error(`\nPaste the missing values into servio-api/.env, then run this again. Nothing was uploaded.`);
  process.exit(1);
}

const result = spawnSync('npx', ['wrangler', 'secret', 'bulk', '--env', 'production'], {
  input: JSON.stringify(values),
  stdio: ['pipe', 'inherit', 'inherit'],
});
if (result.status !== 0) {
  console.error('\nUpload failed. If the Worker does not exist yet, run `npm run deploy` once, then retry.');
  process.exit(result.status ?? 1);
}
console.log('\nProduction secrets uploaded. They apply to the next request; no redeploy needed.');
