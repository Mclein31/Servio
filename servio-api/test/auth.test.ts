// auth tests
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { count, eq, sql } from 'drizzle-orm';
import { connectDb } from '../src/db/client';
import { loginCodes, users } from '../src/db/schema';
import { MAX_CODE_ATTEMPTS } from '../src/routes/auth';
import { api, hasDb, json, testEmail } from './helpers';

let logged: string[] = [];
beforeEach(() => {
  logged = [];
  vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
    logged.push(String(line));
  });
});
afterEach(() => vi.restoreAllMocks());

function lastCode(): string {
  for (const line of [...logged].reverse()) {
    const match = /"devMail".*?sign-in code is (\d{6})/.exec(line);
    if (match) return match[1]!;
  }
  throw new Error('no code logged');
}

describe.runIf(hasDb)('email-code sign-in', () => {
  it('signs in a new customer, returns /me, then signs out', async () => {
    const email = testEmail('new');
    const sent = await api('/auth/request-code', json({ email }));
    expect(sent.status).toBe(202);
    expect(await sent.json()).toMatchObject({ sent: true, devNote: expect.any(String) });

    const verified = await api('/auth/verify-code', json({ email: email.toUpperCase(), code: lastCode() }));
    expect(verified.status).toBe(200);
    const session = (await verified.json()) as { accessToken: string; user: { email: string; role: string; isNew: boolean } };
    expect(session.user).toMatchObject({ email, role: 'CUSTOMER', isNew: true });

    const auth = { Authorization: `Bearer ${session.accessToken}` };
    const me = await api('/me', { headers: auth });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ me: { email } });

    const out = await api('/auth/sign-out', { method: 'POST', headers: auth });
    expect(out.status).toBe(200);
    expect((await api('/me', { headers: auth })).status).toBe(401);
  });

  it('a code works only once, and the same email maps to the same account', async () => {
    const email = testEmail('once');
    await api('/auth/request-code', json({ email }));
    const code = lastCode();
    const first = (await (await api('/auth/verify-code', json({ email, code }))).json()) as { user: { id: string } };
    expect((await api('/auth/verify-code', json({ email, code }))).status).toBe(401);

    await api('/auth/request-code', json({ email }));
    const again = (await (await api('/auth/verify-code', json({ email, code: lastCode() }))).json()) as { user: { id: string; isNew: boolean } };
    expect(again.user.id).toBe(first.user.id);
    expect(again.user.isNew).toBe(false);
  });

  it('only the newest code works', async () => {
    const email = testEmail('newest');
    await api('/auth/request-code', json({ email }));
    const old = lastCode();
    await api('/auth/request-code', json({ email }));
    const fresh = lastCode();
    if (old !== fresh) expect((await api('/auth/verify-code', json({ email, code: old }))).status).toBe(401);
    expect((await api('/auth/verify-code', json({ email, code: fresh }))).status).toBe(200);
  });

  it('issues only one session when the same code is verified concurrently', async () => {
    const email = testEmail('parallel-once');
    await api('/auth/request-code', json({ email }));
    const code = lastCode();
    const results = await Promise.all([
      api('/auth/verify-code', json({ email, code })), api('/auth/verify-code', json({ email, code })),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    const client = (await connectDb(env))!;
    try {
      const result = await client.db.execute(sql`select count(*)::int as n from sessions s join users u on u.id = s.user_id where u.email = ${email}`);
      expect(result.rows[0]).toMatchObject({ n: 1 });
    } finally { await client.close(); }
  });

  it('serializes concurrent wrong attempts and never accepts an exhausted code', async () => {
    const email = testEmail('parallel-lock');
    await api('/auth/request-code', json({ email }));
    const right = lastCode();
    const wrong = right === '000000' ? '111111' : '000000';
    const results = await Promise.all(Array.from({ length: MAX_CODE_ATTEMPTS + 2 },
      () => api('/auth/verify-code', json({ email, code: wrong }))));
    expect(results.every((r) => r.status === 401)).toBe(true);
    expect((await api('/auth/verify-code', json({ email, code: right }))).status).toBe(401);
    const client = (await connectDb(env))!;
    try {
      const [row] = await client.db.select().from(loginCodes).where(eq(loginCodes.email, email));
      expect(row?.attempts).toBe(MAX_CODE_ATTEMPTS);
      const [created] = await client.db.select({ n: count() }).from(users).where(eq(users.email, email));
      expect(created?.n).toBe(0);
    } finally { await client.close(); }
  });

  it('does not create an account from an expired code', async () => {
    const email = testEmail('expired');
    await api('/auth/request-code', json({ email }));
    const code = lastCode();
    const client = (await connectDb(env))!;
    try {
      await client.db.update(loginCodes).set({ expiresAt: new Date(Date.now() - 1) }).where(eq(loginCodes.email, email));
      expect((await api('/auth/verify-code', json({ email, code }))).status).toBe(401);
      const [created] = await client.db.select({ n: count() }).from(users).where(eq(users.email, email));
      expect(created?.n).toBe(0);
    } finally { await client.close(); }
  });

  it('locks the code after too many wrong tries', async () => {
    const email = testEmail('lock');
    await api('/auth/request-code', json({ email }));
    const right = lastCode();
    const wrong = right === '000000' ? '111111' : '000000';
    for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
      expect((await api('/auth/verify-code', json({ email, code: wrong }))).status).toBe(401);
    }
    const locked = await api('/auth/verify-code', json({ email, code: right }));
    expect(locked.status).toBe(401);
    expect(await locked.json()).toMatchObject({ error: { code: 'CODE_LOCKED' } });
  });

  it('validates input and profile updates', async () => {
    expect((await api('/auth/request-code', json({ email: 'not-an-email' }))).status).toBe(422);
    const email = testEmail('profile');
    await api('/auth/request-code', json({ email }));
    const { accessToken } = (await (await api('/auth/verify-code', json({ email, code: lastCode() }))).json()) as { accessToken: string };
    const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
    const bad = await api('/me', { method: 'PATCH', headers, body: JSON.stringify({ phoneNumber: '09171234567' }) });
    expect(bad.status).toBe(422);
    const good = await api('/me', { method: 'PATCH', headers, body: JSON.stringify({ fullName: 'Sophia M.', phoneNumber: '+639171234567' }) });
    expect(await good.json()).toMatchObject({ me: { fullName: 'Sophia M.', phoneNumber: '+639171234567' } });
  });

  it('rate-limits sign-in attempts from one IP', async () => {
    const headers = { 'CF-Connecting-IP': '203.0.113.7' };
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      statuses.push((await api('/auth/verify-code', json({ email: testEmail('rl'), code: '123456' }, headers))).status);
    }
    expect(statuses).toContain(429);
  });

  it('rejects requests without a valid session', async () => {
    expect((await api('/me')).status).toBe(401);
    expect((await api('/me', { headers: { Authorization: 'Bearer ' + 'x'.repeat(43) } })).status).toBe(401);
  });
});
