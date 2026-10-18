import { env } from 'cloudflare:test';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { connectDb } from '../src/db/client';
import { bookings, dispatchOffers, ledgerEntries, proProfiles, proSkus, users } from '../src/db/schema';
import { issueSession } from '../src/middleware/auth';
import { api, hasDb, json, testEmail } from './helpers';
import { dispatchTick } from '../src/dispatch/demo-dispatch';

describe.runIf(hasDb)('demo Pro availability and dispatch', () => {
  let client: NonNullable<Awaited<ReturnType<typeof connectDb>>>;
  let ids: string[]; let headers: Record<string,string>[]; let bookingId: string;
  const poll = async (index = 1) => {
    const result = await api('/pro/dispatch', json({}, headers[index]));
    expect(result.status).toBe(200);
    return result.json() as Promise<{ offer: { id: string; booking: Record<string, unknown> } | null }>;
  };
  const offers = () => client.db.select().from(dispatchOffers).where(eq(dispatchOffers.bookingId, bookingId));
  const balance = async () => (await client.db.execute<{ sum: string }>(sql`SELECT COALESCE(SUM(amount_centavos),0)::text AS sum FROM ledger_entries WHERE account=${`escrow:${bookingId}`}`)).rows[0]!.sum;
  const balanced = async () => {
    const bad = await client.db.execute(sql`SELECT txn_id FROM ledger_entries WHERE booking_id=${bookingId} GROUP BY txn_id HAVING SUM(amount_centavos) <> 0 OR count(*) < 2`);
    expect(bad.rows).toHaveLength(0);
  };
  beforeEach(async () => {
    client = (await connectDb(env))!;
    // Shared, append-only test DB retains prior suites' valid holds. Drain that old
    // backlog with compensating refunds before creating the current eligible Pros.
    for (let pass = 0; pass < 20; pass++) {
      const count = await client.db.execute<{ n: string }>(sql`SELECT count(*)::text AS n FROM bookings WHERE is_demo AND status='PENDING_ACCEPTANCE' AND escrow='HOLD_AUTHORIZED'`);
      if (count.rows[0]!.n === '0') break;
      await dispatchTick(client.db, 'tuguegarao', true);
    }
    const rows = await client.db.insert(users).values([
      { email: testEmail('dispatch-c'), role: 'CUSTOMER', isDemo: true },
      { email: testEmail('dispatch-p1'), role: 'PRO', isDemo: true },
      { email: testEmail('dispatch-p2'), role: 'PRO', isDemo: true },
      { email: testEmail('dispatch-outsider'), role: 'PRO', isDemo: true },
    ]).returning(); ids = rows.map((u) => u.id);
    await client.db.insert(proProfiles).values(ids.slice(1).map((userId, i) => ({ userId, kycStatus: 'APPROVED' as const, isOnline: i < 2, lastLat: 17.618111 + i * 0.01, lastLng: 121.718927, lastLocatedAt: new Date() })));
    await client.db.insert(proSkus).values(ids.slice(1).map((proId) => ({ proId, skuId: 'sku-ac-leak' })));
    headers = await Promise.all(ids.map(async (id) => ({ Authorization: `Bearer ${(await issueSession(client.db, id, undefined)).accessToken}` })));
    const res = await api('/bookings', json({ skuId: 'sku-ac-leak', address: { street: 'Ugac Norte', barangay: 'Ugac Norte', city: 'Tuguegarao City' },
      lat: 17.618111, lng: 121.718927, schedule: 'ASAP', paymentMethod: 'GCASH' }, headers[0]));
    expect(res.status).toBe(201); bookingId = (await res.json() as { booking: { id: string } }).booking.id;
  });
  afterEach(async () => {
    await client.db.update(proProfiles).set({ isOnline: false }).where(inArray(proProfiles.userId, ids.slice(1)));
    await client.db.update(dispatchOffers).set({ expiresAt: new Date(Date.now() - 1000) }).where(and(inArray(dispatchOffers.proId, ids.slice(1)), eq(dispatchOffers.response, 'PENDING')));
    await dispatchTick(client.db, 'tuguegarao', true);
    await client.close();
  });

  it('refreshes only online approved Pro locations without ever toggling availability',async()=>{
    const point={ lat:17.613,lng:121.727 };
    expect((await api('/pro/location',json(point))).status).toBe(401);
    expect((await api('/pro/location',json(point,headers[0]))).status).toBe(403);
    expect((await api('/pro/location',json({ lat:91,lng:121 },headers[1]))).status).toBe(422);
    expect((await api('/pro/location',json(point,headers[1]))).status).toBe(200);
    await api('/pro/availability',json({ online:false },headers[1]));
    expect((await api('/pro/location',json(point,headers[1]))).status).toBe(409);
    const [profile]=await client.db.select().from(proProfiles).where(eq(proProfiles.userId,ids[1]!));
    expect(profile!.isOnline).toBe(false); expect(await balance()).toBe('115000'); await balanced();
  });

  it('requires approved Pro auth and validates paired coordinates without inventing a fresh fix', async () => {
    expect((await api('/pro/availability', json({ online: true }))).status).toBe(401);
    expect((await api('/pro/availability', json({ online: true }, headers[0]))).status).toBe(403);
    expect((await api('/pro/availability', json({ online: true, lat: 17.6 }, headers[1]))).status).toBe(422);
    expect((await api('/pro/availability', json({ online: true, lat: 91, lng: 121 }, headers[1]))).status).toBe(422);
    await client.db.update(proProfiles).set({ kycStatus: 'PENDING' }).where(eq(proProfiles.userId, ids[1]!));
    expect((await api('/pro/availability', json({ online: true }, headers[1]))).status).toBe(403);
    expect((await api('/pro/availability', json({ online: false }, headers[1]))).status).toBe(200);
    await client.db.update(proProfiles).set({ kycStatus: 'APPROVED' }).where(eq(proProfiles.userId, ids[1]!));
    const updated = await api('/pro/availability', json({ online: true, lat: 17.613, lng: 121.727 }, headers[1]));
    expect(await updated.json()).toMatchObject({ pro: { isOnline: true, lastLat: 17.613, lastLng: 121.727 } });
    expect(await balance()).toBe('115000'); await balanced();
  });

  it('offers the nearest qualified Pro, keeps details private, and serializes acceptance without moving escrow', async () => {
    const { offer } = await poll(); expect(offer).not.toBeNull();
    expect((await offers())[0]!.proId).toBe(ids[1]);
    expect(offer!.booking).not.toHaveProperty('completionPin'); expect(offer!.booking).not.toHaveProperty('address'); expect(offer!.booking).not.toHaveProperty('customerId');
    expect((await api(`/bookings/${bookingId}`, { headers: headers[1] })).status).toBe(404);
    expect((await api(`/offers/${offer!.id}/accept`, json({}, headers[3]))).status).toBe(404);
    const attempts = await Promise.all([api(`/offers/${offer!.id}/accept`, json({}, headers[1])), api(`/offers/${offer!.id}/accept`, json({}, headers[1]))]);
    expect(attempts.map((r) => r.status).sort()).toEqual([200,409]);
    const detail = await api(`/bookings/${bookingId}`, { headers: headers[1] });
    const body = await detail.json() as { booking: Record<string, unknown> };
    expect(body.booking).toMatchObject({ proId: ids[1], status: 'ACCEPTED' }); expect(body.booking).not.toHaveProperty('completionPin');
    expect(await balance()).toBe('115000'); await balanced();
  });

  it('allows an approved Pro to queue a second accepted job while finishing another', async () => {
    await client.db.insert(bookings).values({ customerId: ids[0]!, proId: ids[1]!, skuId: 'sku-ac-leak', skuName: 'AC repair', priceCentavos: 110000,
      trustFeeCentavos: 5000, address: { street: 'Ugac Norte', barangay: 'Ugac Norte', city: 'Tuguegarao City' }, lat: 17.618111, lng: 121.718927,
      schedule: 'ASAP', paymentMethod: 'GCASH', status: 'IN_PROGRESS', isDemo: true });
    const offer = (await poll()).offer!;
    expect((await api(`/offers/${offer.id}/accept`, json({}, headers[1]))).status).toBe(200);
    expect(await balance()).toBe('115000'); await balanced();
  });

  it('declines to the next Pro, expires on server time, and refunds exactly once when exhausted', async () => {
    const first = (await poll()).offer!;
    expect((await api(`/offers/${first.id}/decline`, json({}, headers[1]))).status).toBe(200);
    const next = (await offers()).find((o) => o.response === 'PENDING')!;
    expect(next.proId).toBe(ids[2]);
    await client.db.update(dispatchOffers).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(dispatchOffers.id, next.id));
    const expired = await api(`/offers/${next.id}/accept`, json({}, headers[2]));
    expect(expired.status).toBe(409);
    expect((await offers()).find((o) => o.id === next.id)!.response).toBe('EXPIRED');
    await poll(); await poll();
    expect(await balance()).toBe('0');
    const refunds = await client.db.select().from(ledgerEntries).where(and(eq(ledgerEntries.bookingId, bookingId), eq(ledgerEntries.kind, 'REFUND')));
    expect(refunds).toHaveLength(2); await balanced();
  });

  it('offers a qualified Pro beyond 10 km when nearer candidates are offline', async () => {
    await client.db.update(proProfiles).set({ isOnline: false }).where(eq(proProfiles.userId, ids[2]!));
    await client.db.update(proProfiles).set({ lastLat: 17.85, lastLocatedAt: new Date() }).where(eq(proProfiles.userId, ids[1]!));
    expect((await poll()).offer).not.toBeNull();
    expect((await offers())[0]).toMatchObject({ proId: ids[1] });
    expect((await offers())[0]!.distanceM).toBeGreaterThan(10000);
    expect(await balance()).toBe('115000'); await balanced();
  });

  it.each(['stale','offline','unapproved','unqualified','future'])('excludes %s candidates', async (kind) => {
    await client.db.update(proProfiles).set({ isOnline: false }).where(eq(proProfiles.userId, ids[2]!));
    if (kind === 'unqualified') await client.db.delete(proSkus).where(eq(proSkus.proId, ids[1]!));
    else await client.db.update(proProfiles).set(kind === 'stale' ? { lastLocatedAt: new Date(Date.now() - 121000) } : kind === 'future' ? { lastLocatedAt: new Date(Date.now() + 60000) } : kind === 'offline' ? { isOnline: false } : kind === 'unapproved' ? { kycStatus: 'PENDING' } : { lastLat: 18 }).where(eq(proProfiles.userId, ids[1]!));
    expect((await poll()).offer).toBeNull();
    expect(await offers()).toHaveLength(0); expect(await balance()).toBe('0'); await balanced();
  });
});
