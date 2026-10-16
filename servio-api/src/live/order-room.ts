import { DurableObject } from 'cloudflare:workers';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import * as v from 'valibot';
import { connectDb } from '../db/client';
import { bookings, proProfiles, sessions, users } from '../db/schema';
import type { Bindings } from '../env';
import { participantBooking, serverNow } from '../lib/bookings';
import { readLiveTicket, type LiveTicket } from './tickets';
import { ApiError } from '../lib/errors';

const Gps=v.strictObject({ type:v.literal('gps'),lat:v.pipe(v.number(),v.minValue(-90),v.maxValue(90)),lng:v.pipe(v.number(),v.minValue(-180),v.maxValue(180)),
  accuracy:v.pipe(v.number(),v.minValue(0),v.maxValue(10000)),heading:v.optional(v.nullable(v.pipe(v.number(),v.minValue(0),v.maxValue(360)))),ts:v.pipe(v.number(),v.integer()) });
type Attachment=LiveTicket & { validUntil:number };
export type GpsFix=v.InferOutput<typeof Gps> & { receivedAt:number };

/** Hibernatable sockets keep only identity attachments; Postgres owns status and money. */
export class OrderRoom extends DurableObject<Bindings> {
  private tail:Promise<unknown>=Promise.resolve();
  async fetch(request:Request):Promise<Response> {
    if (new URL(request.url).pathname==='/notify' && request.method==='POST') {
      const event=await request.json() as { type:string; eventId?:string; reset?:boolean };
      if(event.reset) await this.ctx.storage.delete('gps');
      if(event.eventId && await this.ctx.storage.get('eventId')===event.eventId) return Response.json({ sent:true });
      if(event.eventId) await this.ctx.storage.put('eventId',event.eventId);
      await this.broadcast(event);
      return Response.json({ sent:true });
    }
    try {
      if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket') return new Response('WebSocket required',{ status:426 });
      const ticket=await readLiveTicket(this.env.PIN_SECRET,new URL(request.url).searchParams.get('token')??undefined);
      const connection=await connectDb(this.env);
      if(!connection) throw new ApiError(503,'LIVE_UNAVAILABLE','Live updates unavailable.');
      try {
        await this.authorize(connection.db,ticket);
        const claim=await this.ctx.blockConcurrencyWhile(async()=>{
          const used=await this.ctx.storage.get<Record<string,number>>('tickets')??{};
          if(used[ticket.nonce]) return 'used';
          if(this.ctx.getWebSockets().filter((ws)=>(ws.deserializeAttachment() as Attachment)?.userId===ticket.userId).length>=8) return 'limit';
          await this.ctx.storage.put('tickets',Object.fromEntries([...Object.entries(used).filter(([,exp])=>exp>Date.now()),[ticket.nonce,ticket.exp]]));
        });
        if(claim==='used') throw new ApiError(401,'LIVE_TICKET_USED','Reconnect to live updates.');
        if(claim==='limit') throw new ApiError(429,'LIVE_LIMIT','Close another window before reconnecting.');
        const [client,server]=Object.values(new WebSocketPair()) as [WebSocket,WebSocket];
        this.ctx.acceptWebSocket(server);
        server.serializeAttachment({ ...ticket,validUntil:Date.now()+300000 } satisfies Attachment);
        server.send(JSON.stringify({ type:'connected',serverNow:Date.now() }));
        const fix=await this.ctx.storage.get<GpsFix>('gps');
        if(fix && ticket.resource.startsWith('booking:')) server.send(JSON.stringify(fix));
        return new Response(null,{ status:101,webSocket:client });
      } finally { await connection.close(); }
    } catch(error) {
      return Response.json({ error:{ code:error instanceof ApiError?error.code:'LIVE_UNAVAILABLE',message:'Reconnect to live updates.' } },{ status:error instanceof ApiError?error.status:503 });
    }
  }
  private async authorize(db:NonNullable<Awaited<ReturnType<typeof connectDb>>>['db'],ticket:LiveTicket) {
    const [session]=await db.select({ role:users.role }).from(sessions).innerJoin(users,eq(users.id,sessions.userId))
      .where(and(eq(sessions.tokenHash,ticket.sessionHash),eq(sessions.userId,ticket.userId),isNull(sessions.revokedAt),gt(sessions.expiresAt,new Date()),eq(users.isActive,true))).limit(1);
    if(!session) throw new ApiError(401,'UNAUTHENTICATED','Sign in again.');
    if(ticket.resource.startsWith('booking:')) return participantBooking(db,ticket.resource.slice(8),ticket.userId);
    if(ticket.resource!==`pro:${ticket.userId}` || session.role!=='PRO') throw new ApiError(403,'FORBIDDEN','Pro required.');
    return null;
  }
  webSocketMessage(ws:WebSocket,message:string|ArrayBuffer):Promise<void> {
    const next=this.tail.then(()=>this.receive(ws,message));
    this.tail=next.catch(()=>undefined); return next;
  }
  private async receive(ws:WebSocket,message:string|ArrayBuffer) {
    const actor=ws.deserializeAttachment() as Attachment;
    if(!actor || actor.validUntil<=Date.now()) { ws.close(4001,'Reconnect'); return; }
    if(message==='ping') { ws.send('pong'); return; }
    let connection:Awaited<ReturnType<typeof connectDb>>=null;
    try {
      if(typeof message!=='string' || message.length>1024) throw new ApiError(422,'GPS_INVALID','Invalid location.');
      const parsed=v.safeParse(Gps,JSON.parse(message));
      if(!parsed.success || Math.abs(parsed.output.ts-Date.now())>120000) throw new ApiError(422,'GPS_INVALID','Invalid or stale location.');
      connection=await connectDb(this.env);
      if(!connection) throw new ApiError(503,'LIVE_UNAVAILABLE','Live updates unavailable.');
      const booking=await this.authorize(connection.db,actor);
      if(!booking || booking.proId!==actor.userId || booking.status!=='EN_ROUTE') throw new ApiError(403,'GPS_FORBIDDEN','Only the assigned en-route Pro may share location.');
      const last=await this.ctx.storage.get<GpsFix>('gps');
      if(last && (Date.now()-last.receivedAt<1000 || parsed.output.ts<=last.ts)) throw new ApiError(429,'GPS_THROTTLED','Wait for the next location fix.');
      const now=await serverNow(connection.db);
      // Global per-Pro conditional update also bounds writes across queued booking rooms.
      await connection.db.update(proProfiles).set({ lastLat:parsed.output.lat,lastLng:parsed.output.lng,lastLocatedAt:now })
        .where(and(eq(proProfiles.userId,actor.userId),sql`(${proProfiles.lastLocatedAt} IS NULL OR ${proProfiles.lastLocatedAt} <= ${new Date(now.getTime()-15000)})`));
      const fix:GpsFix={ ...parsed.output,receivedAt:now.getTime() };
      await this.ctx.storage.put('gps',fix);
      await this.broadcast(fix);
    } catch(error) { ws.send(JSON.stringify({ type:'error',code:error instanceof ApiError?error.code:'GPS_INVALID' })); }
    finally { if(connection) await connection.close(); }
  }
  private async broadcast(event:unknown) {
    const sockets=this.ctx.getWebSockets(); if(!sockets.length) return;
    const connection=await connectDb(this.env); if(!connection) return;
    try {
      for(const ws of sockets) {
        const actor=ws.deserializeAttachment() as Attachment;
        try {
          if(!actor || actor.validUntil<=Date.now()) { ws.close(4001,'Reconnect'); continue; }
          await this.authorize(connection.db,actor);
          ws.send(JSON.stringify(event));
        } catch { ws.close(4001,'Reconnect'); }
      }
    } finally { await connection.close(); }
  }
  webSocketClose(ws:WebSocket,code:number,reason:string) { ws.close(code,reason); }
  webSocketError(ws:WebSocket) { ws.close(1011,'Reconnect'); }
}
