import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import * as v from 'valibot';
import { proProfiles, users } from '../db/schema';
import type { AppEnv } from '../env';
import { validate } from '../lib/validation';
import { requireUser } from '../middleware/auth';
import { withDb } from '../middleware/db';

export const me = new Hono<AppEnv>();
me.use('/me', withDb, requireUser);
me.use('/me/*', withDb, requireUser);

const profileFields = { id: users.id, isDemo: users.isDemo, email: users.email, fullName: users.fullName, phoneNumber: users.phoneNumber, role: users.role, avatarKey: users.avatarKey };

me.get('/me', async (c) => {
  const db = c.get('db');
  const [user] = await db.select(profileFields).from(users).where(eq(users.id, c.get('userId'))).limit(1);
  const [pro] = user?.role === 'PRO' ? await db.select().from(proProfiles).where(eq(proProfiles.userId, user.id)).limit(1) : [];
  return c.json({ me: user, pro: pro ?? null });
});

const PatchProfile = v.strictObject({
  fullName: v.optional(v.pipe(v.string(), v.trim(), v.minLength(2, 'Enter your name.'), v.maxLength(80))),
  /** Philippine mobile in E.164 (+639XXXXXXXXX). */
  phoneNumber: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.regex(/^\+639\d{9}$/, 'Use a Philippine mobile number, e.g. +639171234567.')))),
});

me.patch('/me', validate('json', PatchProfile), async (c) => {
  const patch = c.req.valid('json');
  const [user] = await c.get('db').update(users).set(patch).where(eq(users.id, c.get('userId'))).returning(profileFields);
  return c.json({ me: user });
});
