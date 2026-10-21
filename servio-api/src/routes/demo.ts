// demo routes
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { requireUser } from '../middleware/auth';
import { withDb } from '../middleware/db';
import { ApiError } from '../lib/errors';
import { resetDemoOrder } from '../demo/reset';
import { bookingDetails, participantBooking } from '../lib/bookings';

export const demo = new Hono<AppEnv>();
demo.use('/demo/*', async (c,next) => {
  if (['production','prod'].includes(c.env.ENVIRONMENT.trim().toLowerCase())) throw new ApiError(404,'NOT_FOUND','Not found.');
  await next();
},withDb,requireUser);
demo.post('/demo/reset-order',async (c) => {
  const id=await resetDemoOrder(c.get('db'),c.get('userId'),c.env.LAUNCH_CITY);
  return c.json({ booking:await bookingDetails(c.get('db'),await participantBooking(c.get('db'),id,c.get('userId')),c.get('userId'),c.env.PIN_SECRET) });
});
