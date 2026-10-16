import { Hono, type Context } from 'hono';
import * as v from 'valibot';
import type { AppEnv } from '../env';
import { withDb } from '../middleware/db';
import { requireUser } from '../middleware/auth';
import { requirePro } from '../middleware/pro';
import { participantBooking } from '../lib/bookings';
import { sha256Hex } from '../lib/crypto';
import { ApiError } from '../lib/errors';
import { mintLiveTicket, readLiveTicket } from '../live/tickets';
import { validate } from '../lib/validation';

export const live=new Hono<AppEnv>();
const id=v.strictObject({ id:v.pipe(v.string(),v.uuid()) });
live.post('/bookings/:id/live-ticket',withDb,requireUser,validate('param',id),async(c)=>{
  const booking=await participantBooking(c.get('db'),c.req.valid('param').id,c.get('userId'));
  const token=await mintLiveTicket(c.env.PIN_SECRET,`booking:${booking.id}`,c.get('userId'),await sha256Hex(c.req.header('Authorization')!.slice(7)));
  return c.json({ token,expiresInSeconds:60 });
});
live.post('/pro/live-ticket',withDb,requireUser,requirePro,async(c)=>{
  const token=await mintLiveTicket(c.env.PIN_SECRET,`pro:${c.get('userId')}`,c.get('userId'),await sha256Hex(c.req.header('Authorization')!.slice(7)));
  return c.json({ token,expiresInSeconds:60 });
});
async function upgrade(c:Context<AppEnv>,resource?:string) {
  // Ticket is the only query capability; bearer tokens never enter socket URLs.
  const ticket=await readLiveTicket(c.env.PIN_SECRET,c.req.query('token'));
  if(resource && ticket.resource!==resource || !resource && !ticket.resource.startsWith('pro:')) throw new ApiError(401,'LIVE_TICKET_INVALID','Reconnect to live updates.');
  return c.env.ORDER_ROOMS.getByName(ticket.resource).fetch(new Request(`http://order-room/connect?token=${encodeURIComponent(c.req.query('token')!)}`,{ headers:{ Upgrade:c.req.header('Upgrade')??'' } }));
}
live.get('/bookings/:id/live',validate('param',id),async(c)=>upgrade(c,`booking:${c.req.valid('param').id}`));
live.get('/pro/live',async(c)=>upgrade(c));
