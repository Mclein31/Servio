// notifications routes
import { and, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import * as v from 'valibot';
import type { AppEnv } from '../env';
import { notifications, NOTIFICATION_KINDS } from '../db/schema';
import type { Executor } from '../db/client';
import { validate } from '../lib/validation';
import { requireUser } from '../middleware/auth';
import { withDb } from '../middleware/db';

export const inbox = new Hono<AppEnv>();
inbox.use('/notifications', withDb, requireUser);
inbox.use('/notifications/*', withDb, requireUser);

const unread = async (db: Executor, userId: string) =>
  (await db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt))))[0]!.n;

inbox.get('/notifications', validate('query', v.strictObject({
  before: v.optional(v.pipe(v.string(), v.uuid())),
  limit: v.optional(v.pipe(v.string(), v.regex(/^\d{1,2}$/), v.transform(Number), v.minValue(1), v.maxValue(50)), '30'),
})), async (c) => {
  const { before, limit } = c.req.valid('query'); const userId = c.get('userId'); const db = c.get('db');
  const rows = await db.select().from(notifications).where(and(eq(notifications.userId, userId),
    before ? sql`(${notifications.createdAt}, ${notifications.id}) < (SELECT created_at, id FROM notifications WHERE id = ${before} AND user_id = ${userId})` : undefined,
  )).orderBy(desc(notifications.createdAt), desc(notifications.id)).limit(limit + 1);
  return c.json({ notifications: rows.slice(0, limit), nextCursor: rows.length > limit ? rows[limit - 1]!.id : null, unreadCount: await unread(db, userId) });
});

inbox.post('/notifications/read', validate('json', v.pipe(v.strictObject({
  ids: v.optional(v.pipe(v.array(v.pipe(v.string(), v.uuid())), v.minLength(1), v.maxLength(100))),
  bookingId: v.optional(v.pipe(v.string(), v.uuid())),
  kind: v.optional(v.picklist(NOTIFICATION_KINDS)),
  all: v.optional(v.literal(true)),
}), v.check((i) => [i.ids, i.bookingId, i.all].filter((x) => x !== undefined).length === 1, 'Choose ids, bookingId or all.'))), async (c) => {
  const input = c.req.valid('json'); const userId = c.get('userId'); const db = c.get('db');
  await db.update(notifications).set({ readAt: sql`now()` }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt),
    input.ids ? inArray(notifications.id, input.ids) : undefined,
    input.bookingId ? eq(notifications.bookingId, input.bookingId) : undefined,
    input.kind ? eq(notifications.kind, input.kind) : undefined));
  return c.json({ unreadCount: await unread(db, userId) });
});
