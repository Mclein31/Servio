import { env } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ledgerEntries, uploads, users } from '../src/db/schema';
import { api, bookingFixture, hasDb } from './helpers';

describe.runIf(hasDb)('real account profile editing',()=>{
  let f:Awaited<ReturnType<typeof bookingFixture>>;
  beforeEach(async()=>{ f=await bookingFixture(); });
  afterEach(async()=>{ await f.close(); });
  const patch=(body:unknown,headers:Record<string,string>=f.headers.customer)=>api('/me',{ method:'PATCH',headers:{ ...headers,'Content-Type':'application/json' },body:JSON.stringify(body) });
  it('persists name/mobile/current photo only for the authenticated owner without changing money',async()=>{
    const original=await f.db.select().from(ledgerEntries).where(eq(ledgerEntries.bookingId,f.booking.id));
    const key=`uploads/avatar/2026/10/${crypto.randomUUID()}.png`;
    await f.db.insert(uploads).values({ key,ownerId:f.customer.id,purpose:'avatar',contentType:'image/png',contentLength:3 });
    await env.UPLOADS.put(key,new Uint8Array([1,2,3]),{ httpMetadata:{ contentType:'image/png' } });
    expect(await (await patch({ fullName:'  Updated Customer  ',phoneNumber:'+639171234567',avatarKey:key })).json()).toMatchObject({ me:{ fullName:'Updated Customer',phoneNumber:'+639171234567',avatarKey:key,email:f.customer.email,role:'CUSTOMER' } });
    expect(await (await api('/me',{ headers:f.headers.customer })).json()).toMatchObject({ me:{ fullName:'Updated Customer',avatarKey:key } });
    const [other]=await f.db.select().from(users).where(eq(users.id,f.pro.id)); expect(other!.avatarKey).toBeNull();
    expect((await patch({ avatarKey:null,phoneNumber:null })).status).toBe(200);
    expect(await f.db.select().from(ledgerEntries).where(eq(ledgerEntries.bookingId,f.booking.id))).toEqual(original);
  });
  it('rejects missing auth, other owners/purposes, incomplete files and privilege/identity changes',async()=>{
    expect((await patch({ fullName:'Test Name' },{})).status).toBe(401);
    for(const body of [{},{ fullName:' ' },{ phoneNumber:'09171234567' },{ email:'takeover@servio.test' },{ role:'PRO' },{ isDemo:true }]) expect((await patch(body)).status).toBe(422);
    expect((await patch({ avatarKey:f.evidenceKey })).status).toBe(404);
    const key=`uploads/avatar/2026/10/${crypto.randomUUID()}.png`;
    await f.db.insert(uploads).values({ key,ownerId:f.pro.id,purpose:'avatar',contentType:'image/png',contentLength:3 });
    expect((await patch({ avatarKey:key })).status).toBe(404);
    await f.db.update(uploads).set({ ownerId:f.customer.id }).where(eq(uploads.key,key));
    expect((await patch({ avatarKey:key })).status).toBe(422);
  });
});
