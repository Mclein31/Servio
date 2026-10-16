import { env } from 'cloudflare:test';
import app from '../src/index';

export const hasDb = env.TEST_HAS_DATABASE === 'true';

/**
 * Each call gets its own client IP: the per-IP sign-in rate limit (10/min) is real in tests,
 * and every suite would otherwise share one "local" IP.
 */
export function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('CF-Connecting-IP')) headers.set('CF-Connecting-IP', `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`);
  return app.request(`http://servio.test/api/v1${path}`, { ...init, headers }, env);
}

export function json(body: unknown, headers: Record<string, string> = {}): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) };
}

/** Unique per run so suites never collide on the shared test database. */
export const testEmail = (tag: string) => `${tag}.${crypto.randomUUID().slice(0, 8)}@servio.test`;
