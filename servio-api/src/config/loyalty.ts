// loyalty milestones
// A customer earns one coupon when their completed bookings reach each milestone.
// Coupons discount the base service price only; SERVIO funds them, so Pro earnings are unchanged.
export interface LoyaltyMilestone {
  completedOrders: number;
  percentOff: number;
  maxDiscountCentavos: number;
}

export const LOYALTY_MILESTONES: readonly LoyaltyMilestone[] = [
  { completedOrders: 3, percentOff: 10, maxDiscountCentavos: 10000 },
  { completedOrders: 10, percentOff: 15, maxDiscountCentavos: 20000 },
  { completedOrders: 15, percentOff: 20, maxDiscountCentavos: 30000 },
];

export function couponDiscount(priceCentavos: number, coupon: Pick<LoyaltyMilestone, 'percentOff' | 'maxDiscountCentavos'>): number {
  const raw = Math.floor((priceCentavos * coupon.percentOff) / 100);
  return Math.max(0, Math.min(raw, coupon.maxDiscountCentavos, priceCentavos - 1));
}
