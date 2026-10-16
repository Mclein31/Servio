import { env } from 'cloudflare:test';
import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bookings, ledgerEntries, proProfiles } from '../src/db/schema';
import { simulatedGpsAllowed } from '../src/live/order-room';
import { mintLiveTicket, readLiveTicket } from '../src/live/tickets';
import { api, bookingFixture, hasDb, json } from './helpers';

const sockets:WebSocket[]=[];
function reader(ws:WebSocket) {
  const queue:Record<string,unknown>[]=[]; const listeners:((v:Record<string,unknown>)=>void)[]=[];
  ws.addEventListener('message',(event)=>{ if(event.data==='pong') return; const data=JSON.parse(String(event.data)); queue.push(data); for(const listen of [...listeners]) listen(data); });
  return async(type:string):Promise<Record<string,unknown>>=>{
    const index=queue.findIndex((e)=>e.type===type); if(index>=0) return queue.splice(index,1)[0]!;
    return new Promise((resolve,reject)=>{
      const listen=(data:Record<string,unknown>)=>{ if(data.type===type) { clearTimeout(timeout); listeners.splice(listeners.indexOf(listen),1); queue.splice(queue.indexOf(data),1); resolve(data); } };
      const timeout=setTimeout(()=>{ listeners.splice(listeners.indexOf(listen),1); reject(new Error(`No ${type} event`)); },3000);
      listeners.push(listen);
    });
  };
}

describe('live ticket capability',()=>{
  it('permits simulated fixes only for demo bookings outside production',()=>{
    expect(simulatedGpsAllowed('development',true)).toBe(true);
    for(const name of ['production',' PRODUCTION ','prod']) expect(simulatedGpsAllowed(name,true)).toBe(false);
    expect(simulatedGpsAllowed('development',false)).toBe(false);
  });
  it('expires and binds the session/resource with a signature',async()=>{
    const token=await mintLiveTicket(env.PIN_SECRET,'booking:00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','a'.repeat(64));
    expect(await readLiveTicket(env.PIN_SECRET,token)).toMatchObject({ sessionHash:'a'.repeat(64) });
    await expect(readLiveTicket(env.PIN_SECRET,token+'x')).rejects.toThrow();
    const [body,sig]=token.split('.'); const payload=JSON.parse(atob(body!)); payload.exp=Date.now()-1;
    await expect(readLiveTicket(env.PIN_SECRET,btoa(JSON.stringify(payload))+'.'+sig)).rejects.toThrow();
    await expect(readLiveTicket(env.PIN_SECRET,undefined)).rejects.toThrow();
    vi.useFakeTimers();
    try { vi.setSystemTime(Date.now()+61000); await expect(readLiveTicket(env.PIN_SECRET,token)).rejects.toThrow(); } finally { vi.useRealTimers(); }
  });
});

describe.runIf(hasDb)('OrderRoom sockets in Miniflare',()=>{
  let f:Awaited<ReturnType<typeof bookingFixture>>;
  beforeEach(async()=>{ f=await bookingFixture('EN_ROUTE'); });
  afterEach(async()=>{ for(const ws of sockets.splice(0)) ws.close(1000,'Test complete'); await f.close(); });
  async function ticket(headers:Record<string,string>) {
    const result=await api(`/bookings/${f.booking.id}/live-ticket`,json({},headers));
    expect(result.status).toBe(200); return (await result.json() as { token:string }).token;
  }
  async function connect(headers:Record<string,string>) {
    const token=await ticket(headers);
    const result=await api(`/bookings/${f.booking.id}/live?token=${encodeURIComponent(token)}`,{ headers:{ Upgrade:'websocket' } });
    expect(result.status).toBe(101); const ws=result.webSocket!; sockets.push(ws); const next=reader(ws); ws.accept();
    await next('connected'); return { ws,next,token };
  }

  it('rejects non-participants, missing/replayed/cross-booking tickets and revoked sessions',async()=>{
    expect((await api(`/bookings/${f.booking.id}/live-ticket`,json({}))).status).toBe(401);
    expect((await api(`/bookings/${f.booking.id}/live-ticket`,json({},f.headers.other))).status).toBe(404);
    expect((await api(`/bookings/${f.booking.id}/live`,{ headers:{ Upgrade:'websocket' } })).status).toBe(401);
    const client=await connect(f.headers.customer);
    expect((await api(`/bookings/${f.booking.id}/live?token=${client.token}`,{ headers:{ Upgrade:'websocket' } })).status).toBe(401);
    const different=crypto.randomUUID();
    expect((await api(`/bookings/${different}/live?token=${await ticket(f.headers.customer)}`,{ headers:{ Upgrade:'websocket' } })).status).toBe(401);
    const fresh=await ticket(f.headers.customer);
    await api('/auth/sign-out',json({},f.headers.customer));
    expect((await api(`/bookings/${f.booking.id}/live?token=${fresh}`,{ headers:{ Upgrade:'websocket' } })).status).toBe(401);
  });

  it('delivers only assigned-Pro GPS, validates/throttles it and bounds profile writes to 15 seconds',async()=>{
    const customer=await connect(f.headers.customer); const pro=await connect(f.headers.pro);
    const before=await f.db.select().from(ledgerEntries).where(eq(ledgerEntries.bookingId,f.booking.id));
    const gps={ type:'gps',lat:17.613,lng:121.727,accuracy:8,heading:90,ts:Date.now() };
    customer.ws.send(JSON.stringify(gps)); expect(await customer.next('error')).toMatchObject({ code:'GPS_FORBIDDEN' });
    pro.ws.send(JSON.stringify({ ...gps,simulated:true })); expect(await pro.next('error')).toMatchObject({ code:'GPS_FORBIDDEN' });
    pro.ws.send(JSON.stringify({ ...gps,lat:999 })); expect(await pro.next('error')).toMatchObject({ code:'GPS_INVALID' });
    pro.ws.send(JSON.stringify(gps)); expect(await customer.next('gps')).toMatchObject({ lat:17.613,lng:121.727 }); await pro.next('gps');
    const [first]=await f.db.select().from(proProfiles).where(eq(proProfiles.userId,f.pro.id));
    pro.ws.send(JSON.stringify({ ...gps,ts:Date.now()+1 })); expect(await pro.next('error')).toMatchObject({ code:'GPS_THROTTLED' });
    await new Promise((resolve)=>setTimeout(resolve,1050));
    pro.ws.send(JSON.stringify({ ...gps,lat:17.614,ts:Date.now() })); expect(await customer.next('gps')).toMatchObject({ lat:17.614 }); await pro.next('gps');
    const [second]=await f.db.select().from(proProfiles).where(eq(proProfiles.userId,f.pro.id)); expect(second!.lastLocatedAt).toEqual(first!.lastLocatedAt);
    const newCustomer=await connect(f.headers.customer); expect(await newCustomer.next('gps')).toMatchObject({ lat:17.614 });
    expect(await f.db.select().from(ledgerEntries).where(eq(ledgerEntries.bookingId,f.booking.id))).toEqual(before);
  });

  it('broadcasts committed chat, add-on and status invalidations without exposing a PIN',async()=>{
    const customer=await connect(f.headers.customer); const pro=await connect(f.headers.pro);
    expect((await api(`/bookings/${f.booking.id}/messages`,json({ body:'Gate 2, please.' },f.headers.customer))).status).toBe(201);
    expect(await pro.next('message')).toEqual({ type:'message',bookingId:f.booking.id });
    expect((await api(`/bookings/${f.booking.id}/status`,json({ to:'ARRIVED' },f.headers.pro))).status).toBe(200);
    expect(await customer.next('status')).toEqual({ type:'status',bookingId:f.booking.id });
    const quote=await api(`/bookings/${f.booking.id}/addons`,json({ addonSkuId:'addon-drain-hose',photoKey:f.evidenceKey,note:'Worn hose' },f.headers.pro));
    expect(quote.status).toBe(201); expect(await customer.next('addon')).toEqual({ type:'addon',bookingId:f.booking.id });
    pro.ws.send(JSON.stringify({ type:'gps',lat:17.613,lng:121.727,accuracy:5,ts:Date.now() }));
    expect(await pro.next('error')).toMatchObject({ code:'GPS_FORBIDDEN' });
    const bad=await f.db.execute(sql`SELECT txn_id FROM ledger_entries GROUP BY txn_id HAVING SUM(amount_centavos)<>0 OR count(*)<2`); expect(bad.rowCount).toBe(0);
  });

  it('authenticates the Pro dispatch room and deduplicates repeated offers',async()=>{
    expect((await api('/pro/live-ticket',json({},f.headers.customer))).status).toBe(403);
    const response=await api('/pro/live-ticket',json({},f.headers.pro)); expect(response.status).toBe(200);
    const { token }=await response.json() as { token:string };
    const result=await api(`/pro/live?token=${token}`,{ headers:{ Upgrade:'websocket' } }); expect(result.status).toBe(101);
    const ws=result.webSocket!; sockets.push(ws); const next=reader(ws); ws.accept(); await next('connected');
    const stub=env.ORDER_ROOMS.getByName(`pro:${f.pro.id}`);
    await stub.fetch('http://order-room/notify',{ method:'POST',body:JSON.stringify({ type:'dispatch',eventId:'offer-1' }) });
    expect(await next('dispatch')).toMatchObject({ eventId:'offer-1' });
  });
});
