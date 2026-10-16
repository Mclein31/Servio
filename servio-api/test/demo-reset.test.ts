import { env } from 'cloudflare:test';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectDb } from '../src/db/client';
import { addonQuotes, bookingEvents, bookings, ledgerEntries, proProfiles, uploads, users } from '../src/db/schema';
import { DEMO, demoId } from '../src/demo/guard';
import { DEMO_IMAGES } from '../src/demo/data';
import { issueSession } from '../src/middleware/auth';
import app from '../src/index';
import { api, hasDb, json, testEmail } from './helpers';

describe.runIf(hasDb)('demo order reset', () => {
  let client: NonNullable<Awaited<ReturnType<typeof connectDb>>>;
  let customer: Record<string,string>, pro: Record<string,string>, stranger: Record<string,string>;
  const reset=() => api('/demo/reset-order',json({},customer));
  beforeAll(async () => {
    client=(await connectDb(env))!;
    // Reserved IDs exercise the runtime boundary without colliding with old test order codes.
    await client.db.insert(users).values([{ id:DEMO.customer,email:'reset-customer@servio.test',isDemo:true },{ id:DEMO.daniel,email:'reset-pro@servio.test',role:'PRO',isDemo:true }]).onConflictDoNothing();
    await client.db.insert(proProfiles).values({ userId:DEMO.daniel,kycStatus:'APPROVED' }).onConflictDoNothing();
    const created=await client.db.insert(bookings).values({ id:DEMO.active,isDemo:true,customerId:DEMO.customer,proId:DEMO.daniel,skuId:'sku-ac-leak',skuName:'AC repair',priceCentavos:110000,trustFeeCentavos:5000,address:{ street:'Ugac Norte',barangay:'Ugac Norte',city:'Tuguegarao City' },lat:17.618111,lng:121.718927,schedule:'ASAP',paymentMethod:'GCASH',status:'EN_ROUTE',escrow:'HOLD_AUTHORIZED' }).onConflictDoNothing().returning();
    if (created.length) { const txnId=crypto.randomUUID(); await client.db.insert(ledgerEntries).values([{ txnId,bookingId:DEMO.active,account:`customer:${DEMO.customer}`,amountCentavos:-115000,kind:'ESCROW_HOLD' },{ txnId,bookingId:DEMO.active,account:`escrow:${DEMO.active}`,amountCentavos:115000,kind:'ESCROW_HOLD' }]); }
    await client.db.insert(bookings).values({ id:demoId(101),isDemo:true,customerId:DEMO.customer,proId:DEMO.daniel,skuId:'sku-ac-leak',skuName:'Queued AC repair',priceCentavos:110000,trustFeeCentavos:5000,address:{ street:'Ugac Norte',barangay:'Ugac Norte',city:'Tuguegarao City' },lat:17.618111,lng:121.718927,schedule:'ASAP',paymentMethod:'GCASH',status:'ACCEPTED' }).onConflictDoNothing();
    const evidence=DEMO_IMAGES.find((i)=>i.purpose==='addon_evidence')!;
    await client.db.insert(uploads).values({ key:evidence.key,ownerId:DEMO.daniel,purpose:'addon_evidence',contentType:'image/png',contentLength:3 }).onConflictDoNothing();
    const auth=async(id:string)=>({ Authorization:`Bearer ${(await issueSession(client.db,id,undefined)).accessToken}` });
    customer=await auth(DEMO.customer); pro=await auth(DEMO.daniel);
    const [other]=await client.db.insert(users).values({ email:testEmail('reset-other'),isDemo:true }).returning(); stranger=await auth(other!.id);
    expect((await reset()).status).toBe(200);
  });
  afterAll(async()=>{ await client.close(); });

  it('requires an authenticated seeded participant and hides itself in production',async()=>{
    expect((await api('/demo/reset-order',json({}))).status).toBe(401);
    expect((await api('/demo/reset-order',json({},stranger))).status).toBe(404);
    expect((await app.request('http://servio.test/api/v1/demo/reset-order',json({},customer),{ ...env,ENVIRONMENT:'production' })).status).toBe(404);
  });

  it('reverses completion, add-on and tip without changing any existing ledger/event row',async()=>{
    const original=await client.db.select().from(ledgerEntries).where(eq(ledgerEntries.bookingId,DEMO.active));
    const oldEvents=await client.db.select().from(bookingEvents).where(eq(bookingEvents.bookingId,DEMO.active));
    for (const to of ['ARRIVED','IN_PROGRESS']) expect((await api(`/bookings/${DEMO.active}/status`,json({ to },pro))).status).toBe(200);
    const evidence=DEMO_IMAGES.find((i)=>i.purpose==='addon_evidence')!.key;
    await env.UPLOADS.put(evidence,new Uint8Array([1,2,3]),{ httpMetadata:{ contentType:'image/png' } });
    const created=await api(`/bookings/${DEMO.active}/addons`,json({ addonSkuId:'addon-drain-hose',photoKey:evidence,note:'Replace worn hose' },pro));
    expect(created.status).toBe(201);
    const { quote }=await created.json() as { quote:{ id:string } };
    expect((await api(`/bookings/${DEMO.active}/addons/${quote.id}/decision`,json({ approve:true },customer))).status).toBe(200);
    const { booking }=await (await api(`/bookings/${DEMO.active}`,{ headers:customer })).json() as { booking:{ completionPin:string } };
    expect((await api(`/bookings/${DEMO.active}/verify-pin`,json({ pin:booking.completionPin },pro))).status).toBe(200);
    expect((await api(`/bookings/${DEMO.active}/review`,json({ rating:5,compliments:[],tipCentavos:10000 },customer))).status).toBe(201);
    const resetResult=await reset(); expect(resetResult.status).toBe(200);
    expect(await resetResult.json()).toMatchObject({ booking:{ status:'EN_ROUTE',escrow:'HOLD_AUTHORIZED',tipCentavos:0,totalCentavos:115000,reviewed:false,addons:[] } });
    const now=await client.db.select().from(ledgerEntries).where(eq(ledgerEntries.bookingId,DEMO.active));
    for (const old of original) expect(now.find((r)=>r.id===old.id)).toEqual(old);
    const events=await client.db.select().from(bookingEvents).where(eq(bookingEvents.bookingId,DEMO.active));
    for (const old of oldEvents) expect(events.find((r)=>r.id===old.id)).toEqual(old);
    const balances=await client.db.execute<{ account:string; n:string }>(sql`SELECT account,SUM(amount_centavos)::text AS n FROM ledger_entries WHERE booking_id=${DEMO.active} GROUP BY account HAVING SUM(amount_centavos)<>0`);
    expect(Object.fromEntries(balances.rows.map((r)=>[r.account,Number(r.n)]))).toEqual({ [`escrow:${DEMO.active}`]:115000,[`customer:${DEMO.customer}`]:-115000 });
    expect(await client.db.select().from(addonQuotes).where(eq(addonQuotes.bookingId,DEMO.active))).toHaveLength(0);
    const bad=await client.db.execute(sql`SELECT txn_id FROM ledger_entries GROUP BY txn_id HAVING SUM(amount_centavos)<>0 OR count(*)<2`);
    expect(bad.rowCount).toBe(0);
  });

  it('repeated and concurrent resets keep exactly one base escrow hold',async()=>{
    expect((await Promise.all([reset(),api('/demo/reset-order',json({},pro))])).map((r)=>r.status)).toEqual([200,200]);
    const total=await client.db.execute<{ n:string }>(sql`SELECT SUM(amount_centavos)::text AS n FROM ledger_entries WHERE account=${`escrow:${DEMO.active}`}`);
    expect(total.rows[0]!.n).toBe('115000');
    const [queued]=await client.db.select().from(bookings).where(eq(bookings.id,demoId(101)));
    expect(queued!.status).toBe('ACCEPTED');
  });
});
