import { env } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ledgerEntries, uploads, users } from '../src/db/schema';
import { api, bookingFixture, hasDb, json } from './helpers';

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

  it('upgrades a customer to Pro, prevents switching to Customer during active jobs, and switches when clear', async () => {
    // 1. Customer upgrades to Pro
    const upgradeRes = await api('/me/upgrade-pro', { method: 'POST', headers: { ...f.headers.customer, 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    expect(upgradeRes.status).toBe(200);
    const upgradeJson = await upgradeRes.json() as any;
    expect(upgradeJson.me.role).toBe('PRO');
    expect(upgradeJson.pro.kycStatus).toBe('APPROVED');
    expect(upgradeJson.pro.isOnline).toBe(false);

    // 2. Switch back to Customer (no active bookings as pro yet)
    const switchCustRes = await api('/me/switch-role', { method: 'POST', headers: { ...f.headers.customer, 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'CUSTOMER' }) });
    expect(switchCustRes.status).toBe(200);
    const switchCustJson = await switchCustRes.json() as any;
    expect(switchCustJson.me.role).toBe('CUSTOMER');
    expect(switchCustJson.pro.kycStatus).toBe('APPROVED');
    expect(switchCustJson.pro.isOnline).toBe(false);

    // 3. Switch back to Pro
    const switchProRes = await api('/me/switch-role', { method: 'POST', headers: { ...f.headers.customer, 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'PRO' }) });
    expect(switchProRes.status).toBe(200);
    const switchProJson = await switchProRes.json() as any;
    expect(switchProJson.me.role).toBe('PRO');

    // 4. Assigned Pro (f.pro) has an active booking (f.booking) - switching to CUSTOMER should be rejected
    const blockedRes = await api('/me/switch-role', { method: 'POST', headers: { ...f.headers.pro, 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'CUSTOMER' }) });
    expect(blockedRes.status).toBe(409);
    const blockedJson = await blockedRes.json() as any;
    expect(blockedJson.error.code).toBe('ACTIVE_BOOKINGS_EXIST');
  });
});

describe.runIf(hasDb)('saved Pro service category', () => {
  let f: Awaited<ReturnType<typeof bookingFixture>>;
  beforeEach(async()=>{ f=await bookingFixture(); });
  afterEach(async()=>{ await f.close(); });
  it('saves offered service IDs and returns them after reopening the account',async()=>{
    const response=await api('/me/pro-trade',json({categoryId:'tutoring'},f.headers.pro));
    expect(response.status).toBe(200);
    const saved=await response.json() as {pro:{headline:string;skuIds:string[]}};
    expect(saved.pro.headline).toBe('Academic Tutor'); expect(saved.pro.skuIds.length).toBeGreaterThan(0);
    const reopened=await (await api('/me',{headers:f.headers.pro})).json() as {pro:{headline:string;skuIds:string[]}};
    expect(reopened.pro.skuIds.sort()).toEqual(saved.pro.skuIds.sort());
    expect(reopened.pro.headline).toBe('Academic Tutor');
    const directory=await (await api('/pros?category=tutoring',{headers:f.headers.customer})).json() as {pros:{id:string}[]};
    expect(directory.pros.some(p=>p.id===f.pro.id)).toBe(true);
  });
});
