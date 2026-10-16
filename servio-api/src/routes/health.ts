import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { connectDb } from '../db/client';
import type { AppEnv } from '../env';

export const health = new Hono<AppEnv>();

/** Liveness + database reachability. Never throws: reports "degraded" instead. */
health.get('/health', async (c) => {
  const started = Date.now();
  let database: 'ok' | 'unconfigured' | 'unreachable' = 'unconfigured';
  let source: string | undefined;
  const client = await connectDb(c.env).catch(() => {
    database = 'unreachable';
    return null;
  });
  if (client) {
    source = client.source;
    try {
      await client.db.execute(sql`select 1`);
      database = 'ok';
    } catch {
      database = 'unreachable';
    } finally {
      await client.close();
    }
  }
  const ok = database === 'ok';
  return c.json(
    { status: ok ? 'ok' : 'degraded', environment: c.env.ENVIRONMENT, database, ...(source ? { databaseSource: source } : {}), latencyMs: Date.now() - started },
    ok ? 200 : 503,
  );
});
