import { and, eq } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { proProfiles, users } from '../db/schema';
import type { AppEnv } from '../env';
import { ApiError } from '../lib/errors';

export const requirePro = createMiddleware<AppEnv>(async (c, next) => {
  const [pro] = await c.get('db').select({ id: users.id }).from(users).innerJoin(proProfiles, eq(proProfiles.userId, users.id))
    .where(and(eq(users.id, c.get('userId')), eq(users.role, 'PRO'))).limit(1);
  if (!pro) throw new ApiError(403, 'PRO_REQUIRED', 'This action requires a Pro account.');
  await next();
});
