import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { ApiError } from '../lib/errors';
import { coordinates } from '../locations/geocoder';
import { requireUser } from '../middleware/auth';
import { withDb } from '../middleware/db';

export const locations = new Hono<AppEnv>();
locations.get('/locations/reverse', withDb, requireUser, async (c) => {
  const url = new URL(c.req.url);
  if (!coordinates(url)) throw new ApiError(400, 'BAD_REQUEST', 'Valid latitude and longitude are required.');
  const stub = c.env.GEOCODER.get(c.env.GEOCODER.idFromName('servio-global-geocoder'));
  const response = await stub.fetch(new Request(url));
  c.header('Cache-Control', 'private, no-store');
  if (response.headers.has('Retry-After')) c.header('Retry-After', response.headers.get('Retry-After')!);
  return c.newResponse(response.body, response.status as 200, { 'Content-Type': 'application/json' });
});
