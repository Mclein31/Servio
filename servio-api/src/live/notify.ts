import { createMiddleware } from 'hono/factory';
import { and, eq } from 'drizzle-orm';
import type { AppEnv } from '../env';
import { connectDb, type Database } from '../db/client';
import { bookings, dispatchOffers, notifications, proProfiles, proSkus, users } from '../db/schema';
import { bookingNotices, bulletinNotices, type BookingChange, type BookingInfo, type Notice } from './notices';

async function send(env:AppEnv['Bindings'],resource:string,event:unknown) {
  await env.ORDER_ROOMS.getByName(resource).fetch('http://order-room/notify',{ method:'POST',headers:{ 'Content-Type':'application/json' },body:JSON.stringify(event) });
}
const sendAll=(env:AppEnv['Bindings'],resources:Iterable<string>,event:unknown)=>Promise.all([...new Set(resources)].map((resource)=>send(env,resource,event)));

/** Inbox rows (the record), then a live refresh of each recipient's bell. */
export async function deliverNotices(env:AppEnv['Bindings'],db:Database,notices:Notice[]) {
  if(!notices.length) return;
  const rows=await db.insert(notifications).values(notices).returning();
  await sendAll(env,rows.map((row)=>`user:${row.userId}`),{ type:'notification' });
}

/** Notifications follow the committed REST response, never a transaction's intermediate state. */
export const notifyLive=createMiddleware<AppEnv>(async(c,next)=>{
  await next();
  if(c.req.method!=='POST' || c.res.status<200 || c.res.status>=300) return;
  const path=c.req.path; const actor=c.get('userId') as string|undefined; const hints=c.get('liveHints') ?? {};
  if(hints.replay) return;
  const notify=async()=>{
    let connection:Awaited<ReturnType<typeof connectDb>>=null;
    const db=async()=>(connection??=await connectDb(c.env))?.db;
    const notices:Notice[]=[];
    try {
      const touched=async(bookingId:string,change:BookingChange,event:Record<string,unknown>)=>{
        const database=await db(); if(!database) return;
        const [info]=await database.select({ id:bookings.id,code:bookings.code,skuName:bookings.skuName,status:bookings.status,customerId:bookings.customerId,proId:bookings.proId })
          .from(bookings).where(eq(bookings.id,bookingId)) as BookingInfo[];
        if(!info) return;
        await sendAll(c.env,[info.customerId,...(info.proId?[info.proId]:[])].map((id)=>`user:${id}`),{ type:'booking',bookingId,...event });
        // A cancelled/changed booking closes its open offer; the Pro's radar must refetch now.
        const offers=await database.select({ proId:dispatchOffers.proId }).from(dispatchOffers).where(and(eq(dispatchOffers.bookingId,bookingId),eq(dispatchOffers.response,'PENDING')));
        await sendAll(c.env,offers.map((o)=>`pro:${o.proId}`),{ type:'dispatch' });
        notices.push(...bookingNotices(info,change,actor));
      };

      const match=/\/bookings\/([0-9a-f-]{36})\/(status|verify-pin|addons|addons\/[^/]+\/decision|messages|review)$/.exec(path);
      if(match) {
        const id=match[1]!; const segment=match[2]!;
        const body=segment==='messages'||segment==='review'||segment.endsWith('/decision') ? await c.res.clone().json() as Record<string,any> : {};
        const kind=segment.startsWith('addons')?'addon':segment==='messages'?'message':'status';
        await send(c.env,`booking:${id}`,{ type:kind,bookingId:id,...(kind==='message' ? { message:body.message } : {}) });
        const change:BookingChange=segment==='messages' ? { kind:'message',body:String(body.message?.body ?? ''),photo:!!body.message?.photoKey }
          : segment==='review' ? { kind:'review',rating:Number(body.review?.rating ?? 0) }
          : segment==='addons' ? { kind:'addon-quote' }
          : segment.endsWith('/decision') ? { kind:'addon-decision',approved:body.quote?.decision==='APPROVED' }
          : { kind:'status' };
        await touched(id,change,{ change:kind,...(kind==='message' ? { message:body.message } : {}) });
      }

      if(/\/bookings$/.test(path)) {
        const { booking }=await c.res.clone().json() as { booking:{ id:string; status:string; skuId:string; isDemo:boolean } };
        await touched(booking.id,{ kind:'created' },{ change:'created' });
        if(booking.status==='PENDING_ACCEPTANCE') {
          // Wake every eligible online Pro; their dispatch heartbeat creates the offer within a round trip.
          const database=await db();
          if(database) {
            const pros=await database.select({ id:users.id }).from(users).innerJoin(proProfiles,eq(proProfiles.userId,users.id)).innerJoin(proSkus,eq(proSkus.proId,users.id))
              .where(and(eq(users.role,'PRO'),eq(users.isActive,true),eq(users.isDemo,booking.isDemo),eq(proProfiles.kycStatus,'APPROVED'),eq(proProfiles.isOnline,true),eq(proSkus.skuId,booking.skuId)));
            await sendAll(c.env,pros.map((p)=>`pro:${p.id}`),{ type:'dispatch' });
          }
        }
      }

      if(path.endsWith('/demo/reset-order')) {
        const body=await c.res.clone().json() as { booking:{ id:string } };
        await send(c.env,`booking:${body.booking.id}`,{ type:'status',bookingId:body.booking.id,reset:true });
      }

      if(/\/offers\/[^/]+\/(accept|decline)$/.test(path)) {
        const body=await c.res.clone().json() as { bookingId:string };
        await send(c.env,`booking:${body.bookingId}`,{ type:'status',bookingId:body.bookingId });
        await touched(body.bookingId,{ kind:'status' },{ change:'status' });
      }

      // Offers created and bookings refunded by this request's dispatch work (heartbeat or decline).
      for(const offer of hints.dispatch?.offered ?? []) {
        await send(c.env,`pro:${offer.proId}`,{ type:'dispatch',eventId:offer.offerId });
        await touched(offer.bookingId,{ kind:'offer',proId:offer.proId },{ change:'status' });
      }
      for(const bookingId of hints.dispatch?.cancelled ?? []) {
        await send(c.env,`booking:${bookingId}`,{ type:'status',bookingId });
        await touched(bookingId,{ kind:'status' },{ change:'status' });
      }

      const bulletin=/\/bulletin\/[0-9a-f-]{36}\/(accept|release|cancel)$/.exec(path);
      if(bulletin && actor) {
        const { request }=await c.res.clone().json() as { request:{ id:string; authorId:string; acceptedProId:string|null } };
        const action=bulletin[1] as 'accept'|'release'|'cancel';
        await sendAll(c.env,[request.authorId,request.acceptedProId,hints.previousProId,actor].filter((id):id is string=>!!id).map((id)=>`user:${id}`),{ type:'bulletin',bulletinId:request.id });
        notices.push(...bulletinNotices(request,action,actor,hints.previousProId));
      }

      const database=notices.length ? await db() : undefined;
      if(database) await deliverNotices(c.env,database,notices);
    } catch(error) {
      // A committed booking/payment never becomes an HTTP failure because a room is unavailable.
      console.error(JSON.stringify({ requestId:c.get('requestId'),code:'LIVE_NOTIFY_FAILED',message:error instanceof Error?error.message:String(error) }));
    } finally { await (connection as Awaited<ReturnType<typeof connectDb>>)?.close(); }
  };
  // Run after commit without holding the caller's successful REST response open.
  let execution: {waitUntil(promise:Promise<unknown>):void} | undefined;
  try { execution=c.executionCtx; } catch { /* Direct request tests have no execution context. */ }
  if(execution)execution.waitUntil(notify());else await notify();
});
