import { env } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectDb } from '../src/db/client';
import { bookingEvents, bookings, ledgerEntries, proProfiles, proSkus, serviceSkus, users } from '../src/db/schema';
import { issueSession } from '../src/middleware/auth';
import { mockPayments } from '../src/payments/mock';
import { api, hasDb, json, testEmail } from './helpers';

export const bookingInput = {
  skuId: 'sku-ac-leak', address: { street: '123 Test Street', barangay: 'Bel-Air', city: 'Makati' },
  lat: 14.563, lng: 121.031, schedule: 'ASAP', paymentMethod: 'GCASH',
};

interface CreatedBooking { booking: typeof bookings.$inferSelect & { totalCentavos: number } }

describe.runIf(hasDb)('booking creation and mock escrow (A3)', () => {
  let client: NonNullable<Awaited<ReturnType<typeof connectDb>>>;
  let customerId: string;
  let proId: string;
  let headers: Record<string, string>;
  let key: string;
  const create = (body: unknown = bookingInput, auth = headers) => api('/bookings', json(body, auth));

  beforeEach(async () => {
    client = (await connectDb(env))!;
    const [customer, pro] = await client.db.insert(users).values([
      { email: testEmail('book-customer'), isDemo: true }, { email: testEmail('book-pro'), role: 'PRO' },
    ]).returning();
    customerId = customer!.id;
    proId = pro!.id;
    await client.db.insert(proProfiles).values({ userId: proId, kycStatus: 'APPROVED', isOnline: true });
    await client.db.insert(proSkus).values({ proId, skuId: bookingInput.skuId });
    const { accessToken } = await issueSession(client.db, customerId, 'booking-test');
    key = crypto.randomUUID();
    headers = { Authorization: `Bearer ${accessToken}`, 'Idempotency-Key': key };
  });
  afterEach(async () => { vi.restoreAllMocks(); await client.close(); });

  it('snapshots catalog price and atomically holds 115000 centavos with no Pro credit', async () => {
    const res = await create();
    expect(res.status).toBe(201);
    const { booking } = await res.json() as CreatedBooking;
    expect(booking).toMatchObject({
      customerId, proId: null, skuId: bookingInput.skuId, skuName: 'Split AC Water Leak Repair',
      priceCentavos: 110000, trustFeeCentavos: 5000, totalCentavos: 115000,
      status: 'PENDING_ACCEPTANCE', escrow: 'HOLD_AUTHORIZED', isDemo: true,
    });
    expect(booking.code).toMatch(/^SRV-\d{4,6}$/);
    expect(booking).not.toHaveProperty('requestHash');
    expect(booking).not.toHaveProperty('idempotencyKey');
    const entries = await client.db.select().from(ledgerEntries).where(eq(ledgerEntries.bookingId, booking.id));
    expect(entries).toHaveLength(2);
    expect(new Set(entries.map((e) => e.txnId)).size).toBe(1);
    expect(entries.reduce((sum, e) => sum + e.amountCentavos, 0)).toBe(0);
    expect(entries.map((e) => [e.account, e.amountCentavos])).toEqual([
      [`customer:${customerId}`, -115000], [`escrow:${booking.id}`, 115000],
    ]);
    expect(await client.db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, booking.id)))
      .toMatchObject([{ actorId: customerId, status: 'PENDING_ACCEPTANCE' }]);
  });

  it('accepts an approved, qualified direct Pro booking', async () => {
    const res = await create({ ...bookingInput, paymentMethod: 'CARD', proId });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ booking: { proId, status: 'ACCEPTED', escrow: 'HOLD_AUTHORIZED' } });
  });

  it('returns the same booking on sequential and simultaneous retries without reauthorizing', async () => {
    const authorize = vi.spyOn(mockPayments, 'authorizeHold');
    const responses = await Promise.all([create(), create(), create()]);
    expect(responses.map((r) => r.status)).toEqual([201, 201, 201]);
    const results = await Promise.all(responses.map((r) => r.json() as Promise<CreatedBooking>));
    expect(new Set(results.map((r) => r.booking.id)).size).toBe(1);
    const retry = await create({ ...bookingInput, address: { city: 'Makati', street: '123 Test Street', barangay: 'Bel-Air' } });
    expect(await retry.json()).toEqual(results[0]);
    expect(authorize).toHaveBeenCalledTimes(1);
    const entries = await client.db.select().from(ledgerEntries).where(eq(ledgerEntries.bookingId, results[0]!.booking.id));
    expect(entries).toHaveLength(2);
  });

  it('rejects reuse of the key for a changed request and scopes keys per customer', async () => {
    const first = await (await create()).json() as CreatedBooking;
    expect((await create({ ...bookingInput, schedule: 'Tomorrow morning' })).status).toBe(409);
    const [other] = await client.db.insert(users).values({ email: testEmail('book-other') }).returning();
    const session = await issueSession(client.db, other!.id, undefined);
    const second = await create(bookingInput, { ...headers, Authorization: `Bearer ${session.accessToken}` });
    expect(second.status).toBe(201);
    expect((await second.json() as CreatedBooking).booking.id).not.toBe(first.booking.id);
  });

  it('requires a valid session', async () => {
    expect((await create(bookingInput, {})).status).toBe(401);
    expect((await create(bookingInput, { Authorization: `Bearer ${'x'.repeat(43)}` })).status).toBe(401);
  });

  it.each([
    { priceCentavos: 1 }, { trustFeeCentavos: 0 }, { status: 'COMPLETED' }, { customerId: crypto.randomUUID() },
    { lat: 91 }, { lng: -181 }, { schedule: '' }, { paymentMethod: 'CASH' }, { proId: 'invalid' },
    { address: { street: '', barangay: 'Bel-Air', city: 'Makati' } }, { skuId: 'unknown-sku' },
  ])('rejects invalid or client-controlled input: %j', async (change) => {
    expect((await create({ ...bookingInput, ...change })).status).toBe(422);
    expect(await client.db.select().from(bookings).where(eq(bookings.idempotencyKey, key))).toHaveLength(0);
  });

  it('rejects inactive SKUs, unapproved or unqualified Pros, self bookings, and malformed keys', async () => {
    await client.db.insert(serviceSkus).values({ id: `inactive-${key}`, categoryId: 'repairs', name: 'Inactive', priceCentavos: 100, unit: 'job', durationLabel: '1h', isActive: false });
    expect((await create({ ...bookingInput, skuId: `inactive-${key}` })).status).toBe(422);
    await client.db.update(proProfiles).set({ kycStatus: 'PENDING' }).where(eq(proProfiles.userId, proId));
    expect((await create({ ...bookingInput, proId })).status).toBe(422);
    await client.db.update(proProfiles).set({ kycStatus: 'APPROVED' }).where(eq(proProfiles.userId, proId));
    expect((await create({ ...bookingInput, proId, skuId: 'sku-laptop-diag' })).status).toBe(422);
    expect((await create({ ...bookingInput, proId: customerId })).status).toBe(422);
    expect((await create(bookingInput, { ...headers, 'Idempotency-Key': 'bad key!' })).status).toBe(422);
  });

  it('rolls back the booking, events and money if mock authorization fails', async () => {
    vi.spyOn(mockPayments, 'authorizeHold').mockRejectedValueOnce(new Error('simulated authorization failure'));
    const before = await client.db.select({ id: ledgerEntries.id }).from(ledgerEntries);
    expect((await create()).status).toBe(500);
    expect(await client.db.select().from(bookings).where(eq(bookings.idempotencyKey, key))).toHaveLength(0);
    expect(await client.db.select({ id: ledgerEntries.id }).from(ledgerEntries)).toHaveLength(before.length);
    expect((await create()).status).toBe(201);
  });
});
