import { and, count, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import * as v from 'valibot';
import { loginCodes, users } from '../db/schema';
import type { AppEnv } from '../env';
import { randomInt, sha256Hex, timingSafeEqualString } from '../lib/crypto';
import { ApiError } from '../lib/errors';
import { sendMail } from '../lib/mailer';
import { validate } from '../lib/validation';
import { issueSession, revokeCurrentSession } from '../middleware/auth';
import { withDb } from '../middleware/db';

/**
 * App sign-in: a 6-digit code sent by email (free via Gmail; Semaphore SMS can replace the
 * delivery later without changing the flow). The same email always maps to the same account.
 */
export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;
export const MAX_CODES_PER_HOUR = 5;

export const EmailSchema = v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email('Enter a valid email address.'), v.maxLength(255));
const CodeSchema = v.pipe(v.string(), v.trim(), v.regex(/^\d{6}$/, 'Enter the 6-digit code.'));

export const auth = new Hono<AppEnv>();
auth.use('/auth/*', withDb);

export const generateCode = (): string => String(randomInt(1_000_000)).padStart(6, '0');
export const codeHash = (email: string, code: string) => sha256Hex(`${email}:${code}`);

async function limit(c: Context<AppEnv>, email: string) {
  const limiter = c.env.AUTH_LIMITER;
  if (!limiter) return;
  for (const key of [`ip:${c.req.header('CF-Connecting-IP') ?? 'local'}`, `email:${email}`]) {
    if (!(await limiter.limit({ key: `auth:${key}` })).success) {
      throw new ApiError(429, 'RATE_LIMITED', 'Too many tries. Please wait a minute and try again.');
    }
  }
}

auth.post('/auth/request-code', validate('json', v.strictObject({ email: EmailSchema })), async (c) => {
  const { email } = c.req.valid('json');
  await limit(c, email);
  const db = c.get('db');
  const [recent] = await db
    .select({ n: count() })
    .from(loginCodes)
    .where(and(eq(loginCodes.email, email), gt(loginCodes.createdAt, new Date(Date.now() - 3_600_000))));
  if ((recent?.n ?? 0) >= MAX_CODES_PER_HOUR) {
    throw new ApiError(429, 'TOO_MANY_CODES', 'You’ve asked for several codes already. Use the newest email, or try again in an hour.');
  }
  const code = generateCode();
  const now = new Date();
  // Only the newest code works.
  await db.update(loginCodes).set({ consumedAt: now }).where(and(eq(loginCodes.email, email), isNull(loginCodes.consumedAt)));
  const [row] = await db
    .insert(loginCodes)
    .values({ email, codeHash: await codeHash(email, code), expiresAt: new Date(now.getTime() + CODE_TTL_MS), ip: c.req.header('CF-Connecting-IP') ?? null })
    .returning({ id: loginCodes.id });

  let delivery: 'sent' | 'logged';
  try {
    delivery = await sendMail(
      c.env,
      {
        to: email,
        subject: `${code} is your SERVIO code`,
        text: `Your SERVIO sign-in code is ${code}\n\nIt works once and expires in 10 minutes.\nIf you didn’t ask for this code, you can ignore this email. Never share it with anyone — including SERVIO staff or your helper.`,
        html: `<div style="font-family:Arial,sans-serif;color:#111827;max-width:420px"><p>Your SERVIO sign-in code is</p><p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:8px 0;color:#D04A00">${code}</p><p>It works once and expires in 10 minutes.</p><p style="color:#6B7280;font-size:13px">If you didn’t ask for this code, you can ignore this email. Never share it with anyone — including SERVIO staff or your helper.</p></div>`,
      },
      c.get('requestId'),
    );
  } catch (err) {
    await db.update(loginCodes).set({ consumedAt: new Date() }).where(eq(loginCodes.id, row!.id));
    throw err;
  }
  return c.json({ sent: true, expiresInMinutes: CODE_TTL_MS / 60_000, ...(delivery === 'logged' ? { devNote: 'Development: the code was written to the API log instead of emailed.' } : {}) }, 202);
});

auth.post('/auth/verify-code', validate('json', v.strictObject({ email: EmailSchema, code: CodeSchema })), async (c) => {
  const { email, code: entered } = c.req.valid('json');
  await limit(c, email);
  const db = c.get('db');
  const wrong = () => new ApiError(401, 'CODE_INVALID', 'That code is wrong or has expired. Check the newest email, or ask for a new code.');
  const [code] = await db
    .select()
    .from(loginCodes)
    .where(and(eq(loginCodes.email, email), isNull(loginCodes.consumedAt), gt(loginCodes.expiresAt, new Date())))
    .orderBy(desc(loginCodes.createdAt))
    .limit(1);
  if (!code) throw wrong();
  if (code.attempts >= MAX_CODE_ATTEMPTS) {
    await db.update(loginCodes).set({ consumedAt: new Date() }).where(eq(loginCodes.id, code.id));
    throw new ApiError(401, 'CODE_LOCKED', 'Too many wrong tries. Ask for a new code.');
  }
  if (!timingSafeEqualString(await codeHash(email, entered), code.codeHash)) {
    await db.update(loginCodes).set({ attempts: sql`${loginCodes.attempts} + 1` }).where(eq(loginCodes.id, code.id));
    throw wrong();
  }

  const result = await db.transaction(async (tx) => {
    // Conditional consume: two parallel verifications can't both succeed.
    const [claimed] = await tx
      .update(loginCodes)
      .set({ consumedAt: new Date() })
      .where(and(eq(loginCodes.id, code.id), isNull(loginCodes.consumedAt)))
      .returning({ id: loginCodes.id });
    if (!claimed) throw wrong();
    const [existing] = await tx
      .select({ id: users.id, isActive: users.isActive, role: users.role })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);
    if (existing && !existing.isActive) throw new ApiError(403, 'ACCOUNT_DISABLED', 'This account is turned off. Please contact SERVIO support.');
    if (existing?.role === 'ADMIN') throw new ApiError(403, 'USE_ADMIN_CONSOLE', 'Staff accounts sign in through the admin console.');
    const user = existing ?? (await tx.insert(users).values({ email, role: 'CUSTOMER' }).returning({ id: users.id, isActive: users.isActive, role: users.role }))[0]!;
    const session = await issueSession(tx, user.id, c.req.header('User-Agent'));
    return { ...session, user: { id: user.id, email, role: user.role, isNew: !existing } };
  });
  return c.json(result);
});

auth.post('/auth/sign-out', async (c) => {
  await revokeCurrentSession(c, c.get('db'));
  // 200 + JSON (not 204): the Workers test runner never exits after a bodiless 204.
  return c.json({ signedOut: true });
});
