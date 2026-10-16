import { env } from 'cloudflare:test';
import { and, eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { connectDb } from '../src/db/client';
import { bookingEvents, bookings, ledgerEntries, proProfiles, proSkus, users } from '../src/db/schema';
import { issueSession } from '../src/middleware/auth';
import { api, hasDb, json, testEmail } from './helpers';

const input = { skuId: 'sku-ac-leak', address: { street: 'Ugac Norte', barangay: 'Ugac Norte', city: 'Tuguegarao City' }, lat: 17.618111, lng: 121.718927, schedule: 'ASAP', paymentMethod: 'GCASH' };
type Booking = typeof bookings.$inferSelect;

describe.runIf(hasDb)('booking status, reads and cancellation (A4)', () => {
  let client: NonNullable<Awaited<ReturnType<typeof connectDb>>>;
  let customerId: string;
  let proId: string;
  let customer: Record<string, string>;
  let pro: Record<string, string>;
  let outsider: Record<string, string>;
  let booking: Booking;
  const change = (to: string, headers = pro, reason?: string) => api(`/bookings/${booking.id}/status`, json({ to, ...(reason ? { reason } : {}) }, headers));
  const state = (status: Booking['status'], patch: Partial<typeof bookings.$inferInsert> = {}) => client.db.update(bookings).set({ status, ...patch }).where(eq(bookings.id, booking.id));
  const net = async (account: string) => {
    const result = await client.db.execute<{ n: string }>(sql`SELECT COALESCE(SUM(amount_centavos),0)::text AS n FROM ledger_entries WHERE account = ${account}`);
    return Number(result.rows[0]!.n);
  };
  const assertBalanced = async () => {
    const entries = await client.db.select().from(ledgerEntries).where(eq(ledgerEntries.bookingId, booking.id));
    const sums = new Map<string, number>();
    for (const e of entries) sums.set(e.txnId, (sums.get(e.txnId) ?? 0) + e.amountCentavos);
    expect([...sums.values()]).toEqual([...sums.values()].map(() => 0));
  };

  beforeEach(async () => {
    client = (await connectDb(env))!;
    const rows = await client.db.insert(users).values([{ email: testEmail('status-c') }, { email: testEmail('status-p'), role: 'PRO' }, { email: testEmail('status-x'), role: 'PRO' }]).returning();
    customerId = rows[0]!.id; proId = rows[1]!.id;
    await client.db.insert(proProfiles).values({ userId: proId, kycStatus: 'APPROVED' });
    await client.db.insert(proSkus).values({ proId, skuId: input.skuId });
    const tokens = await Promise.all(rows.map((u) => issueSession(client.db, u.id, undefined)));
    customer = { Authorization: `Bearer ${tokens[0]!.accessToken}` };
    pro = { Authorization: `Bearer ${tokens[1]!.accessToken}` };
    outsider = { Authorization: `Bearer ${tokens[2]!.accessToken}` };
    const res = await api('/bookings', json({ ...input, proId }, { ...customer, 'Idempotency-Key': crypto.randomUUID() }));
    expect(res.status).toBe(201);
    booking = (await res.json() as { booking: Booking }).booking;
  });
  afterEach(async () => { await client.close(); });

  it('returns participant display identities without contact details, credentials or attempts', async () => {
    const result = await api(`/bookings/${booking.id}`, { headers: customer });
    const body = await result.json() as { booking: Record<string, unknown> };
    expect(body.booking.customer).toEqual({ id: customerId, name: null, avatarKey: null });
    expect(body.booking.pro).toMatchObject({ id: proId, rating: 0, ratingCount: 0 });
    expect(body.booking.reviewed).toBe(false);
    for (const key of ['email', 'phoneNumber', 'pinAttempts', 'requestHash', 'idempotencyKey']) {
      expect(body.booking).not.toHaveProperty(key);
      expect(body.booking.customer).not.toHaveProperty(key);
      expect(body.booking.pro).not.toHaveProperty(key);
    }
  });

  it.each([['ACCEPTED', 'EN_ROUTE'], ['EN_ROUTE', 'ARRIVED'], ['ARRIVED', 'IN_PROGRESS']] as const)('allows assigned Pro %s → %s and appends an event without moving money', async (from, to) => {
    await state(from);
    const res = await change(to);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ booking: { status: to, events: [{ status: 'ACCEPTED' }, { status: to, actorId: proId }] } });
    expect(await net(`escrow:${booking.id}`)).toBe(115000);
    expect(await net(`pro_wallet:${proId}`)).toBe(0);
    await assertBalanced();
  });

  it.each([['ACCEPTED', 'ARRIVED'], ['ACCEPTED', 'COMPLETED'], ['EN_ROUTE', 'IN_PROGRESS'], ['ARRIVED', 'EN_ROUTE'], ['IN_PROGRESS', 'COMPLETED'], ['COMPLETED', 'CANCELLED'], ['CANCELLED', 'EN_ROUTE']] as const)('rejects invalid transition %s → %s', async (from, to) => {
    await state(from);
    const res = await change(to, pro, 'Test cancellation');
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { code: 'INVALID_TRANSITION' } });
    expect(await client.db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, booking.id))).toHaveLength(1);
  });

  it('enforces auth, assignment and status input validation', async () => {
    expect((await change('EN_ROUTE', {})).status).toBe(401);
    expect((await change('EN_ROUTE', customer)).status).toBe(403);
    expect((await change('EN_ROUTE', outsider)).status).toBe(404);
    expect((await change('COMPLETED', customer)).status).toBe(403);
    expect((await change('unknown')).status).toBe(422);
    expect((await change('CANCELLED', customer)).status).toBe(422);
    expect((await api(`/bookings/${booking.id}/status`, json({ to: 'CANCELLED', reason: 'Test', now: '2099-01-01' }, customer))).status).toBe(422);
  });

  it.each([['PENDING_ACCEPTANCE', 0], ['ACCEPTED', 0], ['EN_ROUTE', 10000], ['ARRIVED', 20000]] as const)('customer cancellation from %s keeps fee %i and refunds the remainder', async (from, fee) => {
    await state(from);
    const res = await change('CANCELLED', customer, 'Plans changed');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ booking: { status: 'CANCELLED', escrow: 'REFUNDED' } });
    expect(await net(`escrow:${booking.id}`)).toBe(0);
    expect(await net(`customer:${customerId}`)).toBe(fee ? -fee : 0);
    expect(await net(`pro_wallet:${proId}`)).toBe(fee);
    const events = await client.db.select().from(bookingEvents).where(and(eq(bookingEvents.bookingId, booking.id), eq(bookingEvents.status, 'CANCELLED')));
    expect(events[0]!.note).toContain('Plans changed');
    expect(events[0]!.note).toContain(`fee=${fee}`);
    await assertBalanced();
    expect((await change('CANCELLED', customer, 'Replay')).status).toBe(409);
  });

  it.each(['ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'] as const)('Pro cancellation from %s refunds all and adds one strike', async (from) => {
    await state(from);
    expect((await change('CANCELLED', pro, 'Unable to complete the job')).status).toBe(200);
    expect(await net(`customer:${customerId}`)).toBe(0);
    expect(await net(`pro_wallet:${proId}`)).toBe(0);
    expect(await net(`escrow:${booking.id}`)).toBe(0);
    const [profile] = await client.db.select().from(proProfiles).where(eq(proProfiles.userId, proId));
    expect(profile!.cancellationStrikes).toBe(1);
    await assertBalanced();
  });

  it('requires a dispute for in-progress customer cancellation', async () => {
    await state('IN_PROGRESS');
    const res = await change('CANCELLED', customer, 'Disagreement about work');
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { code: 'DISPUTE_REQUIRED' } });
    expect(await net(`escrow:${booking.id}`)).toBe(115000);
  });

  it('makes a late no-show cancellation free only while EN_ROUTE', async () => {
    await state('EN_ROUTE', { noShowDeadlineAt: new Date(Date.now() - 1000) });
    expect((await change('CANCELLED', customer, 'Pro did not arrive')).status).toBe(200);
    expect(await net(`customer:${customerId}`)).toBe(0);
    expect(await net(`pro_wallet:${proId}`)).toBe(0);
    await assertBalanced();
  });

  it('charges the visit fee after ARRIVED even if the no-show deadline passed', async () => {
    await state('ARRIVED', { noShowDeadlineAt: new Date(Date.now() - 1000) });
    expect((await change('CANCELLED', customer, 'Plans changed after arrival')).status).toBe(200);
    expect(await net(`pro_wallet:${proId}`)).toBe(20000);
  });

  it('serializes concurrent cancellation requests so the escrow is refunded once', async () => {
    await state('EN_ROUTE');
    const responses = await Promise.all([change('CANCELLED', customer, 'First request'), change('CANCELLED', customer, 'Retry')]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await net(`customer:${customerId}`)).toBe(-10000);
    expect(await net(`pro_wallet:${proId}`)).toBe(10000);
    expect(await net(`escrow:${booking.id}`)).toBe(0);
    await assertBalanced();
  });

  it('sets ASAP travel and fixed deadline when EN_ROUTE, using fallback for a stale location', async () => {
    await client.db.update(proProfiles).set({ lastLat: 18, lastLng: 122, lastLocatedAt: new Date(Date.now() - 180000) }).where(eq(proProfiles.userId, proId));
    const res = await change('EN_ROUTE');
    const result = await res.json() as { booking: { expectedArrivalAt: string; noShowDeadlineAt: string; events: { status: string; createdAt: string }[] } };
    const b = result.booking;
    const departure = Date.parse(b.events.find((e) => e.status === 'EN_ROUTE')!.createdAt);
    expect(Date.parse(b.expectedArrivalAt) - departure).toBe(30 * 60000);
    expect(Date.parse(b.noShowDeadlineAt) - Date.parse(b.expectedArrivalAt)).toBe(30 * 60000);
    await change('ARRIVED');
    const [stored] = await client.db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect(stored!.noShowDeadlineAt!.toISOString()).toBe(b.noShowDeadlineAt);
  });

  it('uses a fresh Pro fix and the Tuguegarao travel clamp', async () => {
    await client.db.update(proProfiles).set({ lastLat: 17.613, lastLng: 121.730, lastLocatedAt: new Date() }).where(eq(proProfiles.userId, proId));
    const result = await (await change('EN_ROUTE')).json() as { booking: { expectedArrivalAt: string; events: { status: string; createdAt: string }[] } };
    const b = result.booking;
    expect(Date.parse(b.expectedArrivalAt) - Date.parse(b.events.find((e) => e.status === 'EN_ROUTE')!.createdAt)).toBe(15 * 60000);
  });

  it('requires a structured scheduled window and fixes its deadline at window end +30 min', async () => {
    expect((await api('/bookings', json({ ...input, schedule: 'Today 2–4 PM' }, customer))).status).toBe(422);
    const start = new Date(Date.now() + 3600000).toISOString();
    const end = new Date(Date.now() + 7200000).toISOString();
    expect((await api('/bookings', json({ ...input, schedule: 'Today 2–4 PM', scheduleStartAt: end, scheduleEndAt: start }, customer))).status).toBe(422);
    const res = await api('/bookings', json({ ...input, proId, schedule: 'Today 2–4 PM', scheduleStartAt: start, scheduleEndAt: end }, customer));
    expect(res.status).toBe(201);
    const created = (await res.json() as { booking: Booking }).booking;
    booking = created;
    const result = await (await change('EN_ROUTE')).json() as { booking: { expectedArrivalAt: string; noShowDeadlineAt: string } };
    expect(result.booking.expectedArrivalAt).toBe(end);
    expect(Date.parse(result.booking.noShowDeadlineAt)).toBe(Date.parse(end) + 30 * 60000);
  });

  it('rejects an expired schedule window before writing a booking or escrow', async () => {
    const res = await api('/bookings', json({ ...input, schedule: 'Past window',
      scheduleStartAt: '2020-01-01T01:00:00.000Z', scheduleEndAt: '2020-01-01T02:00:00.000Z',
    }, customer));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: { code: 'SCHEDULE_EXPIRED' } });
    expect(await client.db.select().from(bookings).where(eq(bookings.customerId, customerId))).toHaveLength(1);
    expect(await net(`customer:${customerId}`)).toBe(-115000);
  });

  it('limits reads to participants and paginates customer/Pro bookings without repeats', async () => {
    expect((await api(`/bookings/${booking.id}`, { headers: customer })).status).toBe(200);
    expect((await api(`/bookings/${booking.id}`, { headers: pro })).status).toBe(200);
    expect((await api(`/bookings/${booking.id}`, { headers: outsider })).status).toBe(404);
    expect((await api(`/bookings/${booking.id}`)).status).toBe(401);
    for (let i = 0; i < 3; i++) expect((await api('/bookings', json({ ...input, proId }, customer))).status).toBe(201);
    let cursor: string | null = null;
    const ids: string[] = [];
    do {
      const res = await api(`/bookings?role=customer&status=ACCEPTED&limit=1${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { headers: customer });
      expect(res.status).toBe(200);
      const result = await res.json() as { bookings: { id: string }[]; nextCursor: string | null };
      ids.push(...result.bookings.map((b) => b.id)); cursor = result.nextCursor;
    } while (cursor);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    const proList = await (await api('/bookings?role=pro', { headers: pro })).json() as { bookings: unknown[] };
    expect(proList.bookings).toHaveLength(4);
    expect((await api('/bookings?cursor=not-a-cursor', { headers: customer })).status).toBe(422);
    expect((await api('/bookings?limit=0', { headers: customer })).status).toBe(422);
  });
});
