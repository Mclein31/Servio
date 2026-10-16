import { env } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bulletinRequests, ledgerEntries, proProfiles, proSkus, reviews, uploads, users } from '../src/db/schema';
import { mockPayments } from '../src/payments/mock';
import { api, bookingFixture, hasDb, json } from './helpers';

describe.runIf(hasDb)('reviews, bulletin, chat and directory (A9)', () => {
  let f: Awaited<ReturnType<typeof bookingFixture>>;
  beforeEach(async () => { f = await bookingFixture(); });
  afterEach(async () => { vi.restoreAllMocks(); await f.close(); });
  const review = (body: unknown = { rating: 5, compliments: ['On time', 'Clean work'], body: 'Excellent service', tipCentavos: 10000 }, headers: Record<string,string> = f.headers.customer) => api(`/bookings/${f.booking.id}/review`, json(body, headers));
  const complete = async () => {
    const res = await api(`/bookings/${f.booking.id}`, { headers: f.headers.customer });
    const { booking } = await res.json() as { booking: { completionPin: string } };
    expect((await api(`/bookings/${f.booking.id}/verify-pin`, json({ pin: booking.completionPin }, f.headers.pro))).status).toBe(200);
  };
  const postMessage = (body: unknown, headers: Record<string,string> = f.headers.customer) => api(`/bookings/${f.booking.id}/messages`, json(body, headers));
  const bulletinInput = { categoryId: 'repairs', skuId: 'sku-ac-leak', description: 'Indoor unit leaking water.', neighborhood: 'Ugac Norte, Tuguegarao City', lat: 17.618111, lng: 121.718927 };
  const postBulletin = (body: unknown = bulletinInput, headers: Record<string,string> = f.headers.customer) => api('/bulletin', json(body, headers));

  it('allows one completed-customer review and pays 100% of the tip without touching escrow', async () => {
    await complete();
    expect((await review()).status).toBe(201);
    const tips = await f.db.select().from(ledgerEntries).where(eq(ledgerEntries.kind, 'TIP'));
    const ours = tips.filter((t) => t.bookingId === f.booking.id);
    expect(ours).toHaveLength(2);
    expect(ours.map((t) => [t.account,t.amountCentavos])).toEqual([[`customer:${f.customer.id}`, -10000], [`pro_wallet:${f.pro.id}`, 10000]]);
    expect(ours.reduce((sum,t) => sum+t.amountCentavos,0)).toBe(0);
    expect(ours[0]!.txnId).toBe(ours[1]!.txnId);
    const [profile] = await f.db.select().from(proProfiles).where(eq(proProfiles.userId, f.pro.id));
    expect(profile).toMatchObject({ ratingCount: 1, ratingSum: 5, ratingAvg: '5.00' });
    const wallet = await (await api('/wallet', { headers: f.headers.pro })).json();
    expect(wallet).toMatchObject({ availableCentavos: 103500, pendingEscrowCentavos: 0 });
    expect((await review()).status).toBe(409);
  });

  it('enforces review actor, completion and validation, and creates no tip for zero', async () => {
    expect((await review(undefined, {})).status).toBe(401);
    expect((await review(undefined, f.headers.pro)).status).toBe(403);
    expect((await review(undefined, f.headers.other)).status).toBe(404);
    expect((await review()).status).toBe(409);
    await complete();
    for (const patch of [{ rating: 0 }, { rating: 6 }, { tipCentavos: -1 }, { tipCentavos: 1.5 }]) {
      expect((await review({ rating: 5, compliments: [], tipCentavos: 0, ...patch })).status).toBe(422);
    }
    expect((await review({ rating: 4, compliments: [], tipCentavos: 0 })).status).toBe(201);
    expect(await f.db.select().from(ledgerEntries).where(eq(ledgerEntries.bookingId, f.booking.id))).toHaveLength(5);
  });

  it('serializes duplicate reviews and rolls back a failed tip authorization', async () => {
    await complete();
    vi.spyOn(mockPayments, 'authorizeHold').mockRejectedValueOnce(new Error('Tip authorization failed'));
    expect((await review()).status).toBe(500);
    expect(await f.db.select().from(reviews).where(eq(reviews.bookingId, f.booking.id))).toHaveLength(0);
    const responses = await Promise.all([review(), review()]);
    expect(responses.map((r) => r.status).sort()).toEqual([201,409]);
  });

  it('posts a SKU-priced request and filters urgent and nearby requests', async () => {
    const res = await postBulletin({ ...bulletinInput, urgent: true }); expect(res.status).toBe(201);
    const { request } = await res.json() as { request: { id: string } };
    expect(await (await api('/bulletin?filter=urgent', { headers: f.headers.customer })).json()).toMatchObject({ requests: expect.arrayContaining([expect.objectContaining({ id: request.id, priceCentavos: 110000, title: 'Split AC Water Leak Repair', status: 'URGENT' })]) });
    const nearby = await (await api('/bulletin?filter=nearby&lat=17.618111&lng=121.718927', { headers: f.headers.pro })).json() as { requests: { id: string; distanceKm: number }[] };
    expect(nearby.requests.some((r) => r.id === request.id && r.distanceKm < 0.01)).toBe(true);
    const far = await (await api('/bulletin?filter=nearby&lat=18&lng=122', { headers: f.headers.customer })).json() as { requests: { id: string }[] };
    expect(far.requests.some((r) => r.id === request.id)).toBe(false);
  });

  it('rejects unknown/mismatched SKU, free prices, overlong descriptions and bad location', async () => {
    expect((await postBulletin(undefined, {})).status).toBe(401);
    for (const patch of [{ skuId: 'unknown' }, { categoryId: 'tutoring' }, { priceCentavos: 1 }, { price: 1 }, { description: 'x'.repeat(201) }, { lat: 91 }]) {
      expect((await postBulletin({ ...bulletinInput, ...patch })).status).toBe(422);
    }
    expect((await api('/bulletin?lat=', { headers: f.headers.customer })).status).toBe(422);
  });

  it('restricts chat to participants and writes system messages on status changes', async () => {
    expect((await postMessage({ body: 'Hello' }, {})).status).toBe(401);
    expect((await postMessage({ body: 'Hello' }, f.headers.other)).status).toBe(404);
    expect((await api(`/bookings/${f.booking.id}/messages`, { headers: f.headers.other })).status).toBe(404);
    expect((await postMessage({ body: 'The entrance is off Bassig Street.' })).status).toBe(201);
    expect((await api(`/bookings/${f.booking.id}/status`, json({ to: 'IN_PROGRESS' }, f.headers.pro))).status).toBe(200);
    const all = await (await api(`/bookings/${f.booking.id}/messages`, { headers: f.headers.pro })).json() as { messages: { senderId: string | null; body: string }[] };
    expect(all.messages).toHaveLength(3);
    expect(all.messages.some((m) => m.senderId === null && m.body.includes('in progress'))).toBe(true);
    expect((await postMessage({ body: 'x'.repeat(2001) })).status).toBe(422);
    expect((await postMessage({ body: '   ' })).status).toBe(422);
    await complete();
    expect((await postMessage({ body: 'Too late' })).status).toBe(409);
  });

  it('persists a two-way customer/Pro conversation across independent sessions without moving money', async () => {
    const before = await f.db.select().from(ledgerEntries).where(eq(ledgerEntries.bookingId, f.booking.id));
    expect((await postMessage({ body: 'Please meet at the entrance.' }, f.headers.customer)).status).toBe(201);
    const proRead = await (await api(`/bookings/${f.booking.id}/messages`, { headers: f.headers.pro })).json() as { messages: { body: string; senderId: string | null }[] };
    expect(proRead.messages).toContainEqual(expect.objectContaining({ body: 'Please meet at the entrance.', senderId: f.customer.id }));
    expect((await postMessage({ body: 'Understood, I am on my way.' }, f.headers.pro)).status).toBe(201);
    const customerRead = await (await api(`/bookings/${f.booking.id}/messages`, { headers: f.headers.customer })).json() as { messages: { body: string; senderId: string | null }[] };
    expect(customerRead.messages).toContainEqual(expect.objectContaining({ body: 'Understood, I am on my way.', senderId: f.pro.id }));
    expect(await f.db.select().from(ledgerEntries).where(eq(ledgerEntries.bookingId, f.booking.id))).toEqual(before);
  });

  it('supports owned photo chat and never repurposes KYC or another user’s file', async () => {
    expect((await postMessage({ photoKey: f.evidenceKey }, f.headers.pro)).status).toBe(201);
    expect((await postMessage({ photoKey: f.evidenceKey })).status).toBe(404);
    const key = `uploads/kyc/2026/10/${crypto.randomUUID()}.pdf`;
    await f.db.insert(uploads).values({ key, ownerId: f.customer.id, purpose: 'kyc', contentType: 'application/pdf', contentLength: 3 });
    await env.UPLOADS.put(key, new Uint8Array([1,2,3]), { httpMetadata: { contentType: 'application/pdf' } });
    expect((await postMessage({ photoKey: key })).status).toBe(404);
  });

  it('paginates chat without repeats using exact stored timestamp cursors', async () => {
    expect((await postMessage({ body: 'First' })).status).toBe(201);
    expect((await postMessage({ body: 'Second' }, f.headers.pro)).status).toBe(201);
    let after: string | null = null; const ids: string[] = [];
    do {
      const res = await api(`/bookings/${f.booking.id}/messages?limit=1${after ? `&after=${after}` : ''}`, { headers: f.headers.customer });
      const result = await res.json() as { messages: { id: string }[]; nextCursor: string | null };
      ids.push(...result.messages.map((m) => m.id)); after = result.nextCursor;
    } while (after);
    expect(ids).toHaveLength(3); expect(new Set(ids).size).toBe(3);
    expect((await api(`/bookings/${f.booking.id}/messages?after=${crypto.randomUUID()}`, { headers: f.headers.customer })).status).toBe(422);
  });

  it('filters and ranks eligible local results before limiting more than 100 candidates', async () => {
    await f.db.update(proProfiles).set({ lastLat: 17.618111, lastLng: 121.718927 }).where(eq(proProfiles.userId, f.pro.id));
    const posted = await (await postBulletin()).json() as { request: { id: string } };
    const distant = await f.db.insert(users).values(Array.from({ length: 101 }, () => ({ email: `${crypto.randomUUID()}@servio.test`, role: 'PRO' as const }))).returning({ id: users.id });
    await f.db.insert(proProfiles).values(distant.map((p) => ({ userId: p.id, kycStatus: 'APPROVED' as const, lastLat: 18, lastLng: 122 })));
    await f.db.insert(proSkus).values(distant.map((p) => ({ proId: p.id, skuId: 'sku-ac-leak' })));
    await f.db.insert(bulletinRequests).values(distant.map(() => ({ authorId: f.customer.id, skuId: 'sku-ac-leak', categoryId: 'repairs', description: 'Distant request', neighborhood: 'Test area', lat: 18, lng: 122 })));
    const local = await (await api('/bulletin?filter=nearby&lat=17.618111&lng=121.718927', { headers: f.headers.customer })).json() as { requests: { id: string }[] };
    expect(local.requests.some((r) => r.id === posted.request.id)).toBe(true);
    const directory = await (await api('/pros?category=repairs&lat=17.618111&lng=121.718927', { headers: f.headers.customer })).json() as { pros: { id: string }[] };
    expect(directory.pros.some((p) => p.id === f.pro.id)).toBe(true);
  });

  it('lists only approved active Pros with catalog rates, distance and no contact details', async () => {
    await f.db.update(proProfiles).set({ lastLat: 17.618111, lastLng: 121.718927, isOnline: true }).where(eq(proProfiles.userId, f.pro.id));
    await f.db.insert(proSkus).values([{ proId: f.pro.id, skuId: 'sku-elec-inspect' }, { proId: f.pro.id, skuId: 'sku-laptop-diag' }]);
    await f.db.insert(proProfiles).values({ userId: f.other.id, kycStatus: 'PENDING' });
    await f.db.insert(proSkus).values({ proId: f.other.id, skuId: 'sku-ac-leak' });
    const res = await api('/pros?lat=17.618111&lng=121.718927', { headers: f.headers.customer }); expect(res.status).toBe(200);
    const result = await res.json() as { pros: { id: string; distanceKm: number; fromPriceCentavos: number }[] };
    expect(result.pros.find((p) => p.id === f.pro.id)).toMatchObject({ distanceKm: 0, fromPriceCentavos: 45000 });
    expect(result.pros.some((p) => p.id === f.other.id)).toBe(false);
    expect(JSON.stringify(result)).not.toContain(f.pro.email);
    const tech = await (await api('/pros?category=tech', { headers: f.headers.customer })).json() as { pros: { id: string; fromPriceCentavos: number }[] };
    expect(tech.pros.find((p) => p.id === f.pro.id)!.fromPriceCentavos).toBe(50000);
    expect((await api('/pros')).status).toBe(401);
    expect((await api('/pros?lat=91&lng=121', { headers: f.headers.customer })).status).toBe(422);
  });
});
