import { createMiddleware } from 'hono/factory';
import { connectDb } from '../db/client';
import type { AppEnv } from '../env';
import { ApiError } from '../lib/errors';

/** Opens a per-request database connection and always closes it before the response returns. */
export const withDb = createMiddleware<AppEnv>(async (c, next) => {
  const client = await connectDb(c.env).catch((err: Error) => {
    console.error(JSON.stringify({ requestId: c.get('requestId'), level: 'error', message: `db connect failed: ${err.message}` }));
    return null;
  });
  if (!client) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'The service is temporarily unavailable.');
  c.set('db', client.db);
  try {
    await next();
  } finally {
    await client.close();
  }
});
