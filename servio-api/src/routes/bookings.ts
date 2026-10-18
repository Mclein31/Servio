import { and, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import * as v from 'valibot';
import { cityProfile, CANCELLATION_FEES, estimateTravelMinutes } from '../config/cities';
import { bulletinRequests, addonSkus, addonQuotes, bookingStatus, bookingEvents, bookings as bookingTable, ledgerEntries, proProfiles, proSkus, serviceSkus, users, messages } from '../db/schema';
import type { AppEnv } from '../env';
import { bookingDetails, participantBooking, serverNow } from '../lib/bookings';
import { registerBookingSocial } from './booking-social';
import { completionPin } from '../lib/completion-pin';
import { sha256Hex, timingSafeEqualString } from '../lib/crypto';
import { ApiError } from '../lib/errors';
import { splitPayout, TRUST_FEE_CENTAVOS } from '../lib/money';
import { ownedUpload } from '../lib/uploads';
import { validate } from '../lib/validation';
import { validateServiceLocation } from '../lib/service-area';
import { requireUser } from '../middleware/auth';
import { withDb } from '../middleware/db';
import { mockPayments } from '../payments/mock';

const shortText = (max: number) => v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(max));
const timestamp = v.pipe(v.string(), v.isoTimestamp());
const CreateBooking = v.pipe(v.strictObject({
  skuId: shortText(100),
  address: v.strictObject({ street: shortText(200), barangay: shortText(100), city: shortText(100), landmark: v.optional(shortText(200)) }),
  lat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
  lng: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
  schedule: shortText(100),
  scheduleStartAt: v.optional(timestamp),
  scheduleEndAt: v.optional(timestamp),
  paymentMethod: v.picklist(['GCASH', 'CARD']),
  proId: v.optional(v.pipe(v.string(), v.uuid())),
  bulletinId: v.optional(v.pipe(v.string(), v.uuid())),
}), v.check((input) => input.schedule === 'ASAP'
  ? !input.scheduleStartAt && !input.scheduleEndAt
  : !!input.scheduleStartAt && !!input.scheduleEndAt && Date.parse(input.scheduleEndAt) > Date.parse(input.scheduleStartAt),
'ASAP must omit a window; scheduled bookings require ordered start/end timestamps.'));


export const bookings = new Hono<AppEnv>();
bookings.use('/bookings/*', withDb, requireUser);

bookings.post('/bookings', validate('json', CreateBooking), async (c) => {
  const input = c.req.valid('json');
  validateServiceLocation({ lat: input.lat, lng: input.lng });
  const customerId = c.get('userId');
  const key = c.req.header('Idempotency-Key');
  if (key !== undefined && !/^[A-Za-z0-9_-]{1,128}$/.test(key)) {
    throw new ApiError(422, 'VALIDATION_FAILED', 'Idempotency-Key must contain 1–128 letters, digits, hyphens or underscores.');
  }
  const requestHash = await sha256Hex(JSON.stringify([
    input.skuId, input.address.street, input.address.barangay, input.address.city, input.address.landmark ?? null,
    input.lat, input.lng, input.schedule, input.paymentMethod, input.proId ?? null, input.scheduleStartAt ?? null, input.scheduleEndAt ?? null, ...(input.bulletinId ? [input.bulletinId] : []),
  ]));
  const trustFeeCentavos = Number(c.env.TRUST_FEE_CENTAVOS ?? TRUST_FEE_CENTAVOS);
  if (!Number.isInteger(trustFeeCentavos) || trustFeeCentavos < 0 || trustFeeCentavos > 2_147_483_647) {
    throw new ApiError(503, 'CONFIGURATION_ERROR', 'Booking fees are unavailable. Please try later.');
  }
  const booking = await c.get('db').transaction(async (tx) => {
    // Serialize identical keys before reading or authorizing, including concurrent HTTP retries.
    if (key) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`booking:${customerId}:${key}`}, 0))`);
      const [existing] = await tx.select().from(bookingTable).where(and(eq(bookingTable.customerId, customerId), eq(bookingTable.idempotencyKey, key)));
      if (existing) {
        if (existing.requestHash !== requestHash) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'This key was already used for a different booking.');
        return existing;
      }
    }
    if (input.bulletinId) {
      const [request] = await tx.select().from(bulletinRequests).where(eq(bulletinRequests.id, input.bulletinId)).for('update');
      if (!request) throw new ApiError(404, 'NOT_FOUND', 'Bulletin request not found.');
      if (request.authorId !== customerId) throw new ApiError(403, 'REQUEST_OWNER_REQUIRED', 'Only the customer who posted this request can authorize its booking.');
      if (request.bookingId || request.status !== 'ACCEPTED') throw new ApiError(409, 'REQUEST_CLOSED', 'This request is no longer awaiting checkout.');
      if (!request.acceptedProId || input.proId !== request.acceptedProId || input.skuId !== request.skuId) throw new ApiError(409, 'REQUEST_CHANGED', 'The request or accepting Pro changed. Reopen the bulletin before booking.');
    }
    const [customer] = await tx.select().from(users).where(eq(users.id, customerId));
    if (customer!.role === 'ADMIN') throw new ApiError(403, 'CUSTOMER_REQUIRED', 'Staff accounts cannot book services.');
    const [sku] = await tx.select().from(serviceSkus).where(and(eq(serviceSkus.id, input.skuId), eq(serviceSkus.isActive, true))).for('share');
    if (!sku) throw new ApiError(422, 'SKU_UNAVAILABLE', 'Choose an available service from the catalog.');
    if (input.proId) {
      if (input.proId === customerId) throw new ApiError(422, 'SELF_BOOKING_NOT_ALLOWED', 'You cannot book your own service.');
      const [pro] = await tx.select({ id: users.id }).from(users)
        .innerJoin(proProfiles, eq(proProfiles.userId, users.id))
        .innerJoin(proSkus, eq(proSkus.proId, users.id))
        .where(and(eq(users.id, input.proId), eq(users.role, 'PRO'), eq(users.isActive, true),
          eq(proProfiles.kycStatus, 'APPROVED'), eq(proSkus.skuId, sku.id)));
      if (!pro) throw new ApiError(422, 'PRO_UNAVAILABLE', 'Choose an approved Pro who offers this service.');
    }
    const total = sku.priceCentavos + trustFeeCentavos;
    if (!Number.isSafeInteger(total) || total > 2_147_483_647) throw new ApiError(422, 'AMOUNT_TOO_LARGE', 'This booking exceeds the supported amount.');
    const profile = cityProfile(c.env.LAUNCH_CITY);
    const scheduleStartAt = input.scheduleStartAt ? new Date(input.scheduleStartAt) : null;
    const scheduleEndAt = input.scheduleEndAt ? new Date(input.scheduleEndAt) : null;
    if (scheduleEndAt && scheduleEndAt <= await serverNow(tx)) {
      throw new ApiError(422, 'SCHEDULE_EXPIRED', 'Choose a service window that has not ended.');
    }
    const [row] = await tx.insert(bookingTable).values({
      ...input, scheduleStartAt, scheduleEndAt, expectedArrivalAt: scheduleEndAt,
      noShowDeadlineAt: scheduleEndAt ? new Date(scheduleEndAt.getTime() + profile.noShowGraceMinutes * 60000) : null,
      customerId, skuName: sku.name, priceCentavos: sku.priceCentavos, trustFeeCentavos,
      status: input.proId ? 'ACCEPTED' : 'PENDING_ACCEPTANCE', escrow: 'HOLD_AUTHORIZED',
      isDemo: customer!.isDemo, idempotencyKey: key, requestHash,
    }).returning();
    await mockPayments.authorizeHold({ bookingId: row!.id, customerId, amountCentavos: total, paymentMethod: input.paymentMethod });
    await tx.insert(bookingEvents).values({ bookingId: row!.id, status: row!.status, actorId: customerId, note: 'Mock escrow authorized.' });
    await tx.insert(messages).values({ bookingId: row!.id, body: `Booking ${row!.code} ${input.proId ? 'accepted' : 'posted'}. Mock escrow authorized.` });
    const txnId = crypto.randomUUID();
    await tx.insert(ledgerEntries).values([
      { txnId, account: `customer:${customerId}`, amountCentavos: -total, bookingId: row!.id, kind: 'ESCROW_HOLD' },
      { txnId, account: `escrow:${row!.id}`, amountCentavos: total, bookingId: row!.id, kind: 'ESCROW_HOLD' },
    ]);
    if (input.bulletinId) await tx.update(bulletinRequests).set({ bookingId: row!.id }).where(eq(bulletinRequests.id, input.bulletinId));
    return row!;
  });
  return c.json({ booking: await bookingDetails(c.get('db'), booking) }, 201);
});

const idSchema = v.strictObject({ id: v.pipe(v.string(), v.uuid()) });

bookings.get('/bookings/:id', validate('param', idSchema), async (c) => {
  const row = await participantBooking(c.get('db'), c.req.valid('param').id, c.get('userId'));
  return c.json({ booking: await bookingDetails(c.get('db'), row, c.get('userId'), c.env.PIN_SECRET) });
});

// Contact numbers are available only to the two participants of an accepted, active booking.
bookings.get('/bookings/:id/contact', validate('param', idSchema), async (c) => {
  const userId = c.get('userId');
  const row = await participantBooking(c.get('db'), c.req.valid('param').id, userId);
  c.header('Cache-Control', 'no-store');
  if (!row.proId || !['ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(row.status)) {
    throw new ApiError(409, 'CALL_UNAVAILABLE', 'Calls are available only during an assigned active booking.');
  }
  const peerId = row.customerId === userId ? row.proId : row.customerId;
  const [peer] = await c.get('db').select({ phoneNumber: users.phoneNumber }).from(users)
    .where(and(eq(users.id, peerId), eq(users.isActive, true)));
  return c.json({ phoneNumber: peer?.phoneNumber ?? null });
});

const ListBookings = v.strictObject({
  role: v.optional(v.picklist(['customer', 'pro']), 'customer'),
  status: v.optional(v.picklist(bookingStatus.enumValues)),
  cursor: v.optional(v.pipe(v.string(), v.maxLength(500))),
  limit: v.optional(v.pipe(v.string(), v.regex(/^\d{1,3}$/), v.transform(Number), v.minValue(1), v.maxValue(100)), '20'),
});
const Cursor = v.strictObject({ id: v.pipe(v.string(), v.uuid()) });

bookings.get('/bookings', validate('query', ListBookings), async (c) => {
  const { role, status, cursor, limit } = c.req.valid('query');
  let after: v.InferOutput<typeof Cursor> | undefined;
  if (cursor) {
    try { after = v.parse(Cursor, JSON.parse(atob(cursor))); }
    catch { throw new ApiError(422, 'VALIDATION_FAILED', 'Invalid booking cursor.'); }
  }
  if (after) await participantBooking(c.get('db'), after.id, c.get('userId'));
  const rows = await c.get('db').select().from(bookingTable).where(and(
    eq(role === 'pro' ? bookingTable.proId : bookingTable.customerId, c.get('userId')),
    status ? eq(bookingTable.status, status) : undefined,
    after ? sql`(${bookingTable.createdAt}, ${bookingTable.id}) < (SELECT created_at, id FROM bookings WHERE id = ${after.id})` : undefined,
  )).orderBy(desc(bookingTable.createdAt), desc(bookingTable.id)).limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return c.json({ bookings: await Promise.all(page.map((row) => bookingDetails(c.get('db'), row, c.get('userId'), c.env.PIN_SECRET))),
    nextCursor: rows.length > limit && last ? btoa(JSON.stringify({ id: last.id })) : null });
});

const ChangeStatus = v.strictObject({ to: v.picklist(bookingStatus.enumValues), reason: v.optional(shortText(500)) });
const NEXT_STATUS: Partial<Record<typeof bookingTable.$inferSelect.status, typeof bookingTable.$inferSelect.status>> = {
  ACCEPTED: 'EN_ROUTE', EN_ROUTE: 'ARRIVED', ARRIVED: 'IN_PROGRESS',
};
const invalidTransition = () => new ApiError(409, 'INVALID_TRANSITION', 'That status change is not allowed.');

bookings.post('/bookings/:id/status', validate('param', idSchema), validate('json', ChangeStatus), async (c) => {
  const { to, reason } = c.req.valid('json');
  const userId = c.get('userId');
  const row = await c.get('db').transaction(async (tx) => {
    const booking = await participantBooking(tx, c.req.valid('param').id, userId, true);
    if (['COMPLETED', 'CANCELLED'].includes(booking.status)) throw invalidTransition();
    const [actor] = await tx.select({ role: users.role }).from(users).where(eq(users.id, userId));
    const isPro = booking.proId === userId && actor!.role === 'PRO';
    const isCustomer = booking.customerId === userId;
    const now = await serverNow(tx);
    const profile = cityProfile(c.env.LAUNCH_CITY);
    let note = reason ?? null;
    const patch: Partial<typeof bookingTable.$inferInsert> = { status: to };
    if (to === 'CANCELLED') {
      if (!reason) throw new ApiError(422, 'VALIDATION_FAILED', 'Tell us why this booking is being cancelled.');
      if (!isPro && !isCustomer) throw new ApiError(403, 'FORBIDDEN', 'Only participants may cancel.');
      if (isCustomer && booking.status === 'IN_PROGRESS') {
        throw new ApiError(409, 'DISPUTE_REQUIRED', 'Work has started. Contact support to open a dispute.');
      }
      const noShow = isCustomer && booking.status === 'EN_ROUTE' && booking.noShowDeadlineAt !== null && now > booking.noShowDeadlineAt;
      const fee = isPro || noShow ? 0 : booking.status === 'EN_ROUTE' ? CANCELLATION_FEES.enRouteCentavos
        : booking.status === 'ARRIVED' ? CANCELLATION_FEES.arrivedCentavos : 0;
      const balanceResult = await tx.execute<{ held: string }>(sql`
        SELECT COALESCE(SUM(amount_centavos), 0)::text AS held FROM ledger_entries WHERE account = ${`escrow:${booking.id}`}
      `);
      const held = Number(balanceResult.rows[0]!.held);
      if (!Number.isSafeInteger(held) || held <= 0 || held > 2_147_483_647 || fee > held || (fee && !booking.proId)) {
        throw new ApiError(409, 'ESCROW_INVALID', 'The escrow needs support review before cancelling.');
      }
      const refund = held - fee;
      if (refund) await mockPayments.refund({ bookingId: booking.id, customerId: booking.customerId, amountCentavos: refund, paymentMethod: booking.paymentMethod });
      const txnId = crypto.randomUUID();
      await tx.insert(ledgerEntries).values([
        { txnId, bookingId: booking.id, account: `escrow:${booking.id}`, amountCentavos: -held, kind: 'REFUND' },
        ...(refund ? [{ txnId, bookingId: booking.id, account: `customer:${booking.customerId}`, amountCentavos: refund, kind: 'REFUND' }] : []),
        ...(fee ? [{ txnId, bookingId: booking.id, account: `pro_wallet:${booking.proId}`, amountCentavos: fee, kind: 'REFUND', memo: `${booking.status === 'ARRIVED' ? 'Visit' : 'Trip'} fee` }] : []),
      ]);
      if (isPro) await tx.update(proProfiles).set({ cancellationStrikes: sql`${proProfiles.cancellationStrikes} + 1` }).where(eq(proProfiles.userId, userId));
      patch.escrow = 'REFUNDED';
      note = `${reason} [${isPro ? 'PRO_CANCELLED' : noShow ? 'NO_SHOW' : 'CUSTOMER_CANCELLED'}; fee=${fee}; refund=${refund}]`;
    } else {
      if (!isPro) throw new ApiError(403, 'ASSIGNED_PRO_REQUIRED', 'Only the assigned Pro may advance this booking.');
      if (NEXT_STATUS[booking.status] !== to) throw invalidTransition();
      if (to === 'EN_ROUTE' && !booking.noShowDeadlineAt) {
        const [pro] = await tx.select().from(proProfiles).where(eq(proProfiles.userId, userId));
        const ageMs = pro?.lastLocatedAt ? now.getTime() - pro.lastLocatedAt.getTime() : Infinity;
        const from = pro?.lastLat != null && pro.lastLng != null && ageMs >= 0 && ageMs < profile.freshLocationSeconds * 1000
          ? { lat: pro.lastLat, lng: pro.lastLng } : null;
        patch.expectedArrivalAt = new Date(now.getTime() + estimateTravelMinutes(from, booking, profile) * 60000);
        patch.noShowDeadlineAt = new Date(patch.expectedArrivalAt.getTime() + profile.noShowGraceMinutes * 60000);
      }
    }
    const [changed] = await tx.update(bookingTable).set(patch).where(eq(bookingTable.id, booking.id)).returning();
    await tx.update(bulletinRequests).set({ status: to === 'CANCELLED' ? 'CANCELLED' : to === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'ACCEPTED' }).where(eq(bulletinRequests.bookingId, booking.id));
    await tx.insert(bookingEvents).values({ bookingId: booking.id, status: to, actorId: userId, note, createdAt: now });
    await tx.insert(messages).values({ bookingId: booking.id, body: `Booking status: ${to.replaceAll('_', ' ').toLowerCase()}.`, createdAt: now });
    return changed!;
  });
  return c.json({ booking: await bookingDetails(c.get('db'), row) });
});

const QuoteAddon = v.strictObject({
  addonSkuId: shortText(100),
  photoKey: v.pipe(v.string(), v.regex(/^uploads\/addon_evidence\/\d{4}\/(0[1-9]|1[0-2])\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$/)),
  note: shortText(1000),
});
const addonStage = (status: string) => status === 'ARRIVED' || status === 'IN_PROGRESS';

bookings.post('/bookings/:id/addons', validate('param', idSchema), validate('json', QuoteAddon), async (c) => {
  const quote = await c.get('db').transaction(async (tx) => {
    const row = await participantBooking(tx, c.req.valid('param').id, c.get('userId'), true);
    const [actor] = await tx.select({ role: users.role }).from(users).where(eq(users.id, c.get('userId')));
    if (row.proId !== c.get('userId') || actor!.role !== 'PRO') throw new ApiError(403, 'ASSIGNED_PRO_REQUIRED', 'Only the assigned Pro may request an add-on.');
    if (!addonStage(row.status)) throw invalidTransition();
    const [pending] = await tx.select({ id: addonQuotes.id }).from(addonQuotes).where(and(eq(addonQuotes.bookingId, row.id), eq(addonQuotes.decision, 'PENDING')));
    if (pending) throw new ApiError(409, 'ADDON_PENDING', 'Wait for the customer to decide the current add-on.');
    const input = c.req.valid('json');
    const [sku] = await tx.select().from(addonSkus).where(and(eq(addonSkus.id, input.addonSkuId), eq(addonSkus.isActive, true))).for('share');
    if (!sku) throw new ApiError(422, 'SKU_UNAVAILABLE', 'Choose an available add-on from the catalog.');
    await ownedUpload(tx, c.env, input.photoKey, c.get('userId'), 'addon_evidence');
    const [created] = await tx.insert(addonQuotes).values({ ...input, bookingId: row.id, addonName: sku.name, priceCentavos: sku.priceCentavos, createdBy: c.get('userId') }).returning();
    return created!;
  });
  return c.json({ quote }, 201);
});

bookings.post('/bookings/:id/addons/:quoteId/decision',
  validate('param', v.strictObject({ id: v.pipe(v.string(), v.uuid()), quoteId: v.pipe(v.string(), v.uuid()) })),
  validate('json', v.strictObject({ approve: v.boolean() })), async (c) => {
    const quote = await c.get('db').transaction(async (tx) => {
      const row = await participantBooking(tx, c.req.valid('param').id, c.get('userId'), true);
      if (row.customerId !== c.get('userId')) throw new ApiError(403, 'CUSTOMER_REQUIRED', 'Only the customer may decide an add-on.');
      if (!addonStage(row.status)) throw invalidTransition();
      const [pending] = await tx.select().from(addonQuotes).where(and(eq(addonQuotes.id, c.req.valid('param').quoteId), eq(addonQuotes.bookingId, row.id)));
      if (!pending) throw new ApiError(404, 'NOT_FOUND', 'Add-on not found.');
      if (pending.decision !== 'PENDING') throw new ApiError(409, 'ADDON_ALREADY_DECIDED', 'This add-on has already been decided.');
      const { approve } = c.req.valid('json');
      if (approve) {
        const totals = await bookingDetails(tx, row);
        if (totals.totalCentavos + pending.priceCentavos > 2_147_483_647) throw new ApiError(422, 'AMOUNT_TOO_LARGE', 'This booking exceeds the supported amount.');
        await mockPayments.authorizeHold({ bookingId: row.id, customerId: row.customerId, amountCentavos: pending.priceCentavos, paymentMethod: row.paymentMethod });
        const txnId = crypto.randomUUID();
        await tx.insert(ledgerEntries).values([
          { txnId, bookingId: row.id, account: `customer:${row.customerId}`, amountCentavos: -pending.priceCentavos, kind: 'ADDON_HOLD', memo: pending.addonName },
          { txnId, bookingId: row.id, account: `escrow:${row.id}`, amountCentavos: pending.priceCentavos, kind: 'ADDON_HOLD', memo: pending.addonName },
        ]);
      }
      const [changed] = await tx.update(addonQuotes).set({ decision: approve ? 'APPROVED' : 'DECLINED', decidedAt: await serverNow(tx) }).where(eq(addonQuotes.id, pending.id)).returning();
      return changed!;
    });
    return c.json({ quote });
  });


bookings.post('/bookings/:id/verify-pin', validate('param', idSchema),
  validate('json', v.strictObject({ pin: v.pipe(v.string(), v.regex(/^\d{4}$/)) })), async (c) => {
    const result = await c.get('db').transaction(async (tx) => {
      const row = await participantBooking(tx, c.req.valid('param').id, c.get('userId'), true);
      const [actor] = await tx.select({ role: users.role }).from(users).where(eq(users.id, c.get('userId')));
      if (row.proId !== c.get('userId') || actor!.role !== 'PRO') throw new ApiError(403, 'ASSIGNED_PRO_REQUIRED', 'Only the assigned Pro may verify completion.');
      if (!addonStage(row.status)) throw invalidTransition();
      if (row.pinAttempts >= 5) throw new ApiError(423, 'PIN_LOCKED', 'Too many wrong PINs. Contact support to unlock completion.');
      const expected = await completionPin(c.env.PIN_SECRET, row.id);
      if (!timingSafeEqualString(expected, c.req.valid('json').pin)) {
        const attempts = row.pinAttempts + 1;
        await tx.update(bookingTable).set({ pinAttempts: attempts }).where(eq(bookingTable.id, row.id));
        // Return the error so the attempt increment commits before Hono sends it.
        return { error: new ApiError(attempts >= 5 ? 423 : 422, attempts >= 5 ? 'PIN_LOCKED' : 'PIN_INVALID', attempts >= 5 ? 'Too many wrong PINs. Contact support.' : 'That completion PIN does not match.') };
      }
      const detail = await bookingDetails(tx, row);
      const gross = detail.totalCentavos - row.trustFeeCentavos;
      const balance = await tx.execute<{ held: string }>(sql`SELECT COALESCE(SUM(amount_centavos),0)::text AS held FROM ledger_entries WHERE account = ${`escrow:${row.id}`}`);
      if (Number(balance.rows[0]!.held) !== detail.totalCentavos || row.escrow !== 'HOLD_AUTHORIZED') {
        throw new ApiError(409, 'ESCROW_INVALID', 'Escrow needs support review before release.');
      }
      await mockPayments.capture({ bookingId: row.id, customerId: row.customerId, amountCentavos: detail.totalCentavos, paymentMethod: row.paymentMethod });
      const split = splitPayout(gross);
      const txnId = crypto.randomUUID();
      await tx.insert(ledgerEntries).values([
        { txnId, bookingId: row.id, account: `escrow:${row.id}`, amountCentavos: -detail.totalCentavos, kind: 'ESCROW_RELEASE' },
        { txnId, bookingId: row.id, account: `pro_wallet:${row.proId}`, amountCentavos: split.proCentavos, kind: 'ESCROW_RELEASE' },
        { txnId, bookingId: row.id, account: 'platform_revenue', amountCentavos: split.platformCentavos + row.trustFeeCentavos, kind: 'ESCROW_RELEASE' },
      ].filter((entry) => entry.amountCentavos !== 0));
      const [changed] = await tx.update(bookingTable).set({ status: 'COMPLETED', escrow: 'COMPLETED' }).where(eq(bookingTable.id, row.id)).returning();
      await tx.update(bulletinRequests).set({ status: 'COMPLETED' }).where(eq(bulletinRequests.bookingId, row.id));
      await tx.insert(bookingEvents).values({ bookingId: row.id, status: 'COMPLETED', actorId: c.get('userId'), note: 'Customer completion PIN verified.', createdAt: await serverNow(tx) });
      await tx.insert(messages).values({ bookingId: row.id, body: 'Job completed. Escrow released after customer PIN verification.', createdAt: await serverNow(tx) });
      await tx.update(proProfiles).set({ jobsDone: sql`${proProfiles.jobsDone} + 1` }).where(eq(proProfiles.userId, row.proId!));
      return { booking: changed! };
    });
    if (result.error) throw result.error;
    return c.json({ booking: await bookingDetails(c.get('db'), result.booking!) });
  });

registerBookingSocial(bookings);
