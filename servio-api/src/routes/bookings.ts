import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import * as v from 'valibot';
import { bookingEvents, bookings as bookingTable, ledgerEntries, proProfiles, proSkus, serviceSkus, users } from '../db/schema';
import type { AppEnv } from '../env';
import { sha256Hex } from '../lib/crypto';
import { ApiError } from '../lib/errors';
import { validate } from '../lib/validation';
import { requireUser } from '../middleware/auth';
import { withDb } from '../middleware/db';
import { mockPayments } from '../payments/mock';

const shortText = (max: number) => v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(max));
const CreateBooking = v.strictObject({
  skuId: shortText(100),
  address: v.strictObject({ street: shortText(200), barangay: shortText(100), city: shortText(100), landmark: v.optional(shortText(200)) }),
  lat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
  lng: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
  schedule: shortText(100),
  paymentMethod: v.picklist(['GCASH', 'CARD']),
  proId: v.optional(v.pipe(v.string(), v.uuid())),
});

export const bookings = new Hono<AppEnv>();
bookings.use('/bookings/*', withDb, requireUser);

function publicBooking(row: typeof bookingTable.$inferSelect) {
  const { idempotencyKey: _key, requestHash: _hash, pinAttempts: _attempts, ...booking } = row;
  return { ...booking, totalCentavos: row.priceCentavos + row.trustFeeCentavos };
}

bookings.post('/bookings', validate('json', CreateBooking), async (c) => {
  const input = c.req.valid('json');
  const customerId = c.get('userId');
  const key = c.req.header('Idempotency-Key');
  if (key !== undefined && !/^[A-Za-z0-9_-]{1,128}$/.test(key)) {
    throw new ApiError(422, 'VALIDATION_FAILED', 'Idempotency-Key must contain 1–128 letters, digits, hyphens or underscores.');
  }
  const requestHash = await sha256Hex(JSON.stringify([
    input.skuId, input.address.street, input.address.barangay, input.address.city, input.address.landmark ?? null,
    input.lat, input.lng, input.schedule, input.paymentMethod, input.proId ?? null,
  ]));
  const trustFeeCentavos = Number(c.env.TRUST_FEE_CENTAVOS ?? '5000');
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
    const [customer] = await tx.select().from(users).where(eq(users.id, customerId));
    if (customer!.role === 'ADMIN') throw new ApiError(403, 'CUSTOMER_REQUIRED', 'Staff accounts cannot book services.');
    const [sku] = await tx.select().from(serviceSkus).where(and(eq(serviceSkus.id, input.skuId), eq(serviceSkus.isActive, true))).for('share');
    if (!sku) throw new ApiError(422, 'SKU_UNAVAILABLE', 'Choose an available service from the catalog.');
    if (input.proId) {
      const [pro] = await tx.select({ id: users.id }).from(users)
        .innerJoin(proProfiles, eq(proProfiles.userId, users.id))
        .innerJoin(proSkus, eq(proSkus.proId, users.id))
        .where(and(eq(users.id, input.proId), eq(users.role, 'PRO'), eq(users.isActive, true),
          eq(proProfiles.kycStatus, 'APPROVED'), eq(proSkus.skuId, sku.id)));
      if (!pro || input.proId === customerId) throw new ApiError(422, 'PRO_UNAVAILABLE', 'Choose an approved Pro who offers this service.');
    }
    const total = sku.priceCentavos + trustFeeCentavos;
    if (!Number.isSafeInteger(total) || total > 2_147_483_647) throw new ApiError(422, 'AMOUNT_TOO_LARGE', 'This booking exceeds the supported amount.');
    const [row] = await tx.insert(bookingTable).values({
      ...input, customerId, skuName: sku.name, priceCentavos: sku.priceCentavos, trustFeeCentavos,
      status: input.proId ? 'ACCEPTED' : 'PENDING_ACCEPTANCE', escrow: 'HOLD_AUTHORIZED',
      isDemo: customer!.isDemo, idempotencyKey: key, requestHash,
    }).returning();
    await mockPayments.authorizeHold({ bookingId: row!.id, customerId, amountCentavos: total, paymentMethod: input.paymentMethod });
    await tx.insert(bookingEvents).values({ bookingId: row!.id, status: row!.status, actorId: customerId, note: 'Mock escrow authorized.' });
    const txnId = crypto.randomUUID();
    await tx.insert(ledgerEntries).values([
      { txnId, account: `customer:${customerId}`, amountCentavos: -total, bookingId: row!.id, kind: 'ESCROW_HOLD' },
      { txnId, account: `escrow:${row!.id}`, amountCentavos: total, bookingId: row!.id, kind: 'ESCROW_HOLD' },
    ]);
    return row!;
  });
  return c.json({ booking: publicBooking(booking) }, 201);
});
