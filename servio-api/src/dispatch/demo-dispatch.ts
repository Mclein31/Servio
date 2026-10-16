import { and, asc, eq, sql } from 'drizzle-orm';
import type { Database, Transaction } from '../db/client';
import { bookingEvents, bookings, dispatchOffers, ledgerEntries, messages } from '../db/schema';
import { cityProfile } from '../config/cities';
import { serverNow } from '../lib/bookings';
import { ApiError } from '../lib/errors';
import { mockPayments } from '../payments/mock';

export const OFFER_SECONDS = 60;

/** Caller holds the booking lock. One offer at a time, up to five distinct eligible Pros. */
export async function advanceDispatch(tx: Transaction, booking: typeof bookings.$inferSelect, city?: string) {
  if (booking.status !== 'PENDING_ACCEPTANCE' || booking.escrow !== 'HOLD_AUTHORIZED') return;
  const now = await serverNow(tx);
  const pending = await tx.select().from(dispatchOffers).where(and(eq(dispatchOffers.bookingId, booking.id), eq(dispatchOffers.response, 'PENDING'))).for('update');
  if (pending.some((o) => o.expiresAt > now)) return;
  for (const offer of pending) await tx.update(dispatchOffers).set({ response: 'EXPIRED', respondedAt: now }).where(eq(dispatchOffers.id, offer.id));
  const attempted = await tx.select({ proId: dispatchOffers.proId }).from(dispatchOffers).where(eq(dispatchOffers.bookingId, booking.id));
  const profile = cityProfile(city);
  type Candidate = { id: string; distanceM: number };
  const result = attempted.length < 5 ? await tx.execute<Candidate>(sql`
    SELECT id, round(distance_km * 1000)::integer AS "distanceM" FROM (
      SELECT u.id, p.rating_avg, 6371 * acos(LEAST(1.0,GREATEST(-1.0,
        sin(radians(p.last_lat))*sin(radians(${booking.lat})) + cos(radians(p.last_lat))*cos(radians(${booking.lat}))*cos(radians(p.last_lng - ${booking.lng}))))) AS distance_km
      FROM users u JOIN pro_profiles p ON p.user_id=u.id JOIN pro_skus ps ON ps.pro_id=u.id
      WHERE u.role='PRO' AND u.is_active AND u.is_demo=${booking.isDemo} AND p.kyc_status='APPROVED' AND p.is_online AND ps.sku_id=${booking.skuId}
        AND u.id <> ${booking.customerId} AND p.last_lat IS NOT NULL AND p.last_lng IS NOT NULL
        AND p.last_located_at <= ${now} AND p.last_located_at > ${new Date(now.getTime() - profile.freshLocationSeconds * 1000)}
        AND NOT EXISTS (SELECT 1 FROM dispatch_offers d WHERE d.booking_id=${booking.id} AND d.pro_id=u.id)
        AND NOT EXISTS (SELECT 1 FROM dispatch_offers d WHERE d.pro_id=u.id AND d.response='PENDING' AND d.expires_at > ${now})
    ) eligible WHERE distance_km <= ${profile.dispatchRadiusKm}
    ORDER BY distance_km, rating_avg DESC, id LIMIT 1
  `) : { rows: [] };
  const next = result.rows[0];
  if (next) {
    await tx.insert(dispatchOffers).values({ bookingId: booking.id, proId: next.id, distanceM: next.distanceM, createdAt: now, expiresAt: new Date(now.getTime() + OFFER_SECONDS * 1000) });
    return;
  }
  const balance = await tx.execute<{ amount: string }>(sql`SELECT COALESCE(SUM(amount_centavos),0)::text AS amount FROM ledger_entries WHERE account=${`escrow:${booking.id}`}`);
  const held = Number(balance.rows[0]!.amount);
  if (!Number.isSafeInteger(held) || held <= 0 || held > 2_147_483_647) throw new ApiError(409, 'ESCROW_INVALID', 'The escrow requires support review.');
  await mockPayments.refund({ bookingId: booking.id, customerId: booking.customerId, amountCentavos: held, paymentMethod: booking.paymentMethod });
  const txnId = crypto.randomUUID();
  await tx.insert(ledgerEntries).values([
    { txnId, bookingId: booking.id, account: `escrow:${booking.id}`, amountCentavos: -held, kind: 'REFUND' },
    { txnId, bookingId: booking.id, account: `customer:${booking.customerId}`, amountCentavos: held, kind: 'REFUND' },
  ]);
  await tx.update(bookings).set({ status: 'CANCELLED', escrow: 'REFUNDED' }).where(eq(bookings.id, booking.id));
  await tx.insert(bookingEvents).values({ bookingId: booking.id, status: 'CANCELLED', note: 'NO_PRO_AVAILABLE; full mock escrow refund.', createdAt: now });
  await tx.insert(messages).values({ bookingId: booking.id, body: 'No available Pro. Your mock escrow hold was refunded in full.', createdAt: now });
}

/** Foreground demo heartbeat; B2 adds event delivery. No background/launch dispatch claim. */
export async function dispatchTick(db: Database, city?: string, isDemo?: boolean) {
  await db.transaction(async (tx) => {
    const pending = await tx.select().from(bookings).where(and(eq(bookings.status, 'PENDING_ACCEPTANCE'), eq(bookings.escrow, 'HOLD_AUTHORIZED'), isDemo === undefined ? undefined : eq(bookings.isDemo, isDemo))).orderBy(asc(bookings.createdAt)).limit(100).for('update', { skipLocked: true });
    for (const booking of pending) await advanceDispatch(tx, booking, city);
  });
}
