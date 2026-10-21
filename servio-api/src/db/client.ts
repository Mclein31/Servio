// database connection
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import type { Bindings } from '../env';
import * as schema from './schema';

export const CONNECT_TIMEOUT_MS = 10_000;

export type ConnectionSource = 'hyperdrive' | 'direct';

export function resolveConnection(env: Pick<Bindings, 'HYPERDRIVE' | 'DATABASE_URL'>): { url: string; source: ConnectionSource } | null {
  if (env.HYPERDRIVE?.connectionString) return { url: env.HYPERDRIVE.connectionString, source: 'hyperdrive' };
  if (env.DATABASE_URL) return { url: env.DATABASE_URL, source: 'direct' };
  return null;
}

export async function connectDb(env: Pick<Bindings, 'HYPERDRIVE' | 'DATABASE_URL'>) {
  const connection = resolveConnection(env);
  if (!connection) return null;
  const client = new Client({
    connectionString: connection.url,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    ssl: connection.source === 'direct' && !isLoopback(connection.url),
  });
  await client.connect();
  return {
    db: drizzle(client, { schema }),
    source: connection.source,
    close: () => client.end().catch(() => undefined),
  };
}

export type Database = NonNullable<Awaited<ReturnType<typeof connectDb>>>['db'];
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type Executor = Database | Transaction;

function isLoopback(url: string): boolean {
  const host = new URL(url).hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}
