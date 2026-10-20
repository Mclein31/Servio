import { env } from 'cloudflare:test';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { connectDb } from '../src/db/client';
import { loginCodes, users } from '../src/db/schema';
import app from '../src/index';
import { codeHash } from '../src/routes/auth';
import { hasDb, json, testEmail } from './helpers';

const fixed = '246810';
function request(path: string, body: unknown, bindings = {}) {
  return app.request(`http://servio.test/api/v1/auth/${path}`, json(body, { 'CF-Connecting-IP': `10.99.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}` }), { ...env, DEMO_LOGIN_CODE: fixed, ...bindings });
}

describe.runIf(hasDb)('guarded demo sign-in', () => {
  let client: NonNullable<Awaited<ReturnType<typeof connectDb>>>;
  const demo = testEmail('demo-auth'), regular = testEmail('regular-auth');
  const disabled = testEmail('disabled-demo'), staff = testEmail('staff-demo');
  beforeAll(async () => {
    client = (await connectDb(env))!;
    await client.db.insert(users).values([
      { email: demo, isDemo: true, fullName: 'Demo Customer' },
      { email: regular },
      { email: disabled, isDemo: true, isActive: false },
      { email: staff, isDemo: true, role: 'ADMIN' },
    ]);
  });
  afterAll(async () => { await client.close(); });

  it('skips email delivery and hourly code quota, signs in only the existing demo identity', async () => {
    const log = vi.spyOn(console, 'log');
    await client.db.insert(loginCodes).values(Array.from({ length: 5 }, () => ({ email: demo, codeHash: 'unused', expiresAt: new Date(Date.now()+60_000) })));
    const sent = await request('request-code', { email: ` ${demo.toUpperCase()} ` });
    expect(sent.status).toBe(202);
    expect(await sent.json()).toMatchObject({ devNote: 'Use the configured demo sign-in code.' });
    expect(log.mock.calls.some(([line]) => String(line).includes('devMail'))).toBe(false);
    log.mockRestore();
    const verified = await request('verify-code', { email: demo.toUpperCase(), code: fixed });
    expect(verified.status).toBe(200);
    const body = await verified.json() as { user: { id: string }; accessToken: string };
    const [user] = await client.db.select().from(users).where(eq(users.email, demo));
    expect(body.user).toMatchObject({ id: user!.id, role: 'CUSTOMER', isNew: false });
    expect((await app.request('http://servio.test/api/v1/me', { headers: { Authorization: `Bearer ${body.accessToken}` } }, env)).status).toBe(200);
    expect((await request('verify-code', { email: demo, code: fixed })).status).toBe(200);
  });

  it('never creates an account or bypasses normal authentication', async () => {
    const missing = testEmail('missing-demo');
    for (const email of [missing, regular]) expect((await request('verify-code', { email, code: fixed })).status).toBe(401);
    expect((await request('verify-code', { email: demo, code: '000000' })).status).toBe(401);
    expect((await request('verify-code', { email: demo, code: 'abc123' })).status).toBe(422);
    const [count] = await client.db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.email, missing));
    expect(count!.n).toBe(0);
  });

  it('disables the fixed-code path in production and when unset or malformed', async () => {
    for (const bindings of [{ ENVIRONMENT: 'production' }, { ENVIRONMENT: ' PRODUCTION ' }, { ENVIRONMENT: 'prod' }, { DEMO_LOGIN_CODE: '' }, { DEMO_LOGIN_CODE: '123' }]) {
      expect((await request('verify-code', { email: demo, code: fixed }, bindings)).status).toBe(401);
    }
  });

  it('respects disabled accounts and the staff console boundary', async () => {
    for (const [email, code] of [[disabled, 'ACCOUNT_DISABLED'], [staff, 'USE_ADMIN_CONSOLE']]) {
      const result = await request('verify-code', { email, code: fixed });
      expect(result.status).toBe(403);
      expect(await result.json()).toMatchObject({ error: { code } });
    }
  });

  it('still accepts a normal single-use email code for non-demo accounts', async () => {
    await client.db.insert(loginCodes).values({ email: regular, codeHash: await codeHash(regular, '135790'), expiresAt: new Date(Date.now()+60_000) });
    expect((await request('verify-code', { email: regular, code: '135790' })).status).toBe(200);
    expect((await request('verify-code', { email: regular, code: '135790' })).status).toBe(401);
  });
});
