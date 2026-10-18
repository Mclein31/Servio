import { createMiddleware } from 'hono/factory';
import { and, eq } from 'drizzle-orm';
import type { AppEnv } from '../env';
import { connectDb } from '../db/client';
import { dispatchOffers, users } from '../db/schema';

async function send(env:AppEnv['Bindings'],resource:string,event:unknown) {
  await env.ORDER_ROOMS.getByName(resource).fetch('http://order-room/notify',{ method:'POST',headers:{ 'Content-Type':'application/json' },body:JSON.stringify(event) });
}
/** Notifications follow the committed REST response, never a transaction's intermediate state. */
export const notifyLive=createMiddleware<AppEnv>(async(c,next)=>{
  await next();
  if(c.req.method!=='POST' || c.res.status<200 || c.res.status>=300) return;
  const path=c.req.path;
  const notify=async()=>{try {
    const match=/\/bookings\/([0-9a-f-]{36})\/(status|verify-pin|addons(?:\/[^/]+\/decision)?|messages|review)$/.exec(path);
    if(match) {
      const payload=match[2]==='messages' ? await c.res.clone().json() as {message:unknown} : undefined;
      await send(c.env,`booking:${match[1]}`,{ type:match[2]!.startsWith('addons')?'addon':match[2]==='messages'?'message':'status',bookingId:match[1],...(payload ? {message:payload.message} : {}) });
    }
    if(path.endsWith('/demo/reset-order')) {
      const body=await c.res.clone().json() as { booking:{ id:string } };
      await send(c.env,`booking:${body.booking.id}`,{ type:'status',bookingId:body.booking.id,reset:true });
    }
    if(/\/offers\/[^/]+\/(accept|decline)$/.test(path)) {
      const body=await c.res.clone().json() as { bookingId:string };
      await send(c.env,`booking:${body.bookingId}`,{ type:'status',bookingId:body.bookingId });
    }
    if(path.endsWith('/pro/dispatch') || /\/offers\/[^/]+\/(accept|decline)$/.test(path)) {
      const connection=await connectDb(c.env); if(!connection) return;
      try {
        const [actor]=await connection.db.select({ isDemo:users.isDemo }).from(users).where(eq(users.id,c.get('userId')));
        const offers=await connection.db.select({ id:dispatchOffers.id,proId:dispatchOffers.proId }).from(dispatchOffers).innerJoin(users,eq(users.id,dispatchOffers.proId))
          .where(and(eq(dispatchOffers.response,'PENDING'),eq(users.isDemo,actor!.isDemo)));
        for(const offer of offers) await send(c.env,`pro:${offer.proId}`,{ type:'dispatch',eventId:offer.id });
      } finally { await connection.close(); }
    }
  } catch {
    // A committed booking/payment never becomes an HTTP failure because a room is unavailable.
    console.error(JSON.stringify({ requestId:c.get('requestId'),code:'LIVE_NOTIFY_FAILED' }));
  }};
  // Run after commit without holding the caller's successful REST response open.
  let execution: {waitUntil(promise:Promise<unknown>):void} | undefined;
  try { execution=c.executionCtx; } catch { /* Direct request tests have no execution context. */ }
  if(execution)execution.waitUntil(notify());else await notify();
});
