// loyalty coupons
import { and, asc, eq, sql } from 'drizzle-orm';
import type { Executor } from '../db/client';
import { customerCoupons } from '../db/schema';
import { couponDiscount, LOYALTY_MILESTONES } from '../config/loyalty';
import { ApiError } from './errors';

export type Coupon = typeof customerCoupons.$inferSelect;

export async function completedOrders(db: Executor, customerId: string): Promise<number> {
  const result = await db.execute<{ n: string }>(sql`SELECT COUNT(*)::text AS n FROM bookings WHERE customer_id = ${customerId} AND status = 'COMPLETED'`);
  return Number(result.rows[0]!.n);
}

// Issues every reached milestone coupon once; returns only the newly issued ones.
export async function issueLoyaltyCoupons(db: Executor, customerId: string): Promise<Coupon[]> {
  const done = await completedOrders(db, customerId);
  const reached = LOYALTY_MILESTONES.filter((m) => m.completedOrders <= done);
  if (!reached.length) return [];
  return db.insert(customerCoupons)
    .values(reached.map((m) => ({ customerId, milestone: m.completedOrders, percentOff: m.percentOff, maxDiscountCentavos: m.maxDiscountCentavos })))
    .onConflictDoNothing({ target: [customerCoupons.customerId, customerCoupons.milestone] })
    .returning();
}

export async function loyaltySummary(db: Executor, customerId: string) {
  const done = await completedOrders(db, customerId);
  const coupons = await db.select().from(customerCoupons).where(eq(customerCoupons.customerId, customerId)).orderBy(asc(customerCoupons.milestone));
  const next = LOYALTY_MILESTONES.find((m) => m.completedOrders > done) ?? null;
  return {
    completedOrders: done,
    milestones: LOYALTY_MILESTONES.map((m) => ({ ...m, reached: m.completedOrders <= done })),
    next: next ? { ...next, ordersToGo: next.completedOrders - done } : null,
    coupons: coupons.map(({ customerId: _owner, ...coupon }) => coupon),
  };
}

// Locks an owned, unused coupon and returns the discount it gives on this price.
export async function claimCoupon(db: Executor, couponId: string, customerId: string, priceCentavos: number) {
  const [coupon] = await db.select().from(customerCoupons).where(and(eq(customerCoupons.id, couponId), eq(customerCoupons.customerId, customerId))).for('update');
  if (!coupon) throw new ApiError(404, 'COUPON_NOT_FOUND', 'Coupon not found.');
  if (coupon.status !== 'AVAILABLE') throw new ApiError(409, 'COUPON_USED', 'This coupon has already been used.');
  return { coupon, discountCentavos: couponDiscount(priceCentavos, coupon) };
}

export async function markRedeemed(db: Executor, couponId: string, bookingId: string, now: Date): Promise<void> {
  await db.update(customerCoupons).set({ status: 'REDEEMED', bookingId, redeemedAt: now }).where(eq(customerCoupons.id, couponId));
}

// A cancelled booking gives its coupon back so the customer can use it again.
export async function restoreCoupon(db: Executor, bookingId: string): Promise<void> {
  await db.update(customerCoupons).set({ status: 'AVAILABLE', bookingId: null, redeemedAt: null })
    .where(and(eq(customerCoupons.bookingId, bookingId), eq(customerCoupons.status, 'REDEEMED')));
}
