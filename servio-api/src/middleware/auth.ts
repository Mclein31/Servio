import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { Executor } from '../db/client';
import { sessions, users } from '../db/schema';
import type { AppEnv } from '../env';
import { randomToken, sha256Hex } from '../lib/crypto';
import { ApiError } from '../lib/errors';

/** App sessions: opaque bearer tokens, stored as SHA-256, valid 30 days. */
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export async function issueSession(db: Executor, userId: string, userAgent: string | undefined) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await db.insert(sessions).values({ userId, tokenHash: await sha256Hex(token), expiresAt, userAgent: userAgent?.slice(0, 255) ?? null });
  return { accessToken: token, expiresAt };
}

function bearer(c: Context<AppEnv>): string | null {
  const match = /^Bearer ([A-Za-z0-9_-]{20,128})$/.exec(c.req.header('Authorization') ?? '');
  return match ? match[1]! : null;
}

async function lookup(db: Executor, token: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: sessions.userId, sessionId: sessions.id, lastSeenAt: sessions.lastSeenAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, await sha256Hex(token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()), eq(users.isActive, true)))
    .limit(1);
  if (!row) return null;
  if (Date.now() - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, row.sessionId));
  }
  return row.userId;
}

/**
 * Requires a valid session. Runs after `withDb`. The user id only ever comes from the
 * server-side session behind the bearer token — never from a header or body field.
 */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const token = bearer(c);
  const userId = token ? await lookup(c.get('db'), token) : null;
  if (!userId) throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in again.');
  c.set('userId', userId);
  await next();
});

/** Revokes the session behind the request's bearer token, if any. */
export async function revokeCurrentSession(c: Context<AppEnv>, db: Executor): Promise<void> {
  const token = bearer(c);
  if (!token) return;
  await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.tokenHash, await sha256Hex(token)), isNull(sessions.revokedAt)));
}
