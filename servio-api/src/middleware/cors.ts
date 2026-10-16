import { cors } from 'hono/cors';
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../env';
import { REQUEST_ID_HEADER } from './request-id';

const LOCAL_DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}$/;

/**
 * CORS restricted to ALLOWED_ORIGINS (which includes the Capacitor app origins
 * capacitor://localhost and http://localhost). In development any localhost port is allowed.
 */
export const corsMiddleware = createMiddleware<AppEnv>((c, next) => {
  const allowed = (c.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return cors({
    origin: (origin) => (allowed.includes(origin) || (c.env.ENVIRONMENT === 'development' && LOCAL_DEV_ORIGIN.test(origin)) ? origin : null),
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', REQUEST_ID_HEADER],
    exposeHeaders: [REQUEST_ID_HEADER],
    maxAge: 600,
  })(c, next);
});
