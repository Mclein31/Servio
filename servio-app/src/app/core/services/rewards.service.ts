// loyalty rewards
import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';

export interface LoyaltyCoupon {
  id: string;
  milestone: number;
  percentOff: number;
  maxDiscountCentavos: number;
  status: 'AVAILABLE' | 'REDEEMED';
  bookingId: string | null;
  redeemedAt: string | null;
  createdAt: string;
}
export interface LoyaltyMilestone { completedOrders: number; percentOff: number; maxDiscountCentavos: number; reached: boolean }
export interface LoyaltySummary {
  completedOrders: number;
  milestones: LoyaltyMilestone[];
  next: (Omit<LoyaltyMilestone, 'reached'> & { ordersToGo: number }) | null;
  coupons: LoyaltyCoupon[];
}

// Mirrors the API rule: percent of the base price, capped, never the whole price.
export function couponDiscountPhp(pricePhp: number, coupon: Pick<LoyaltyCoupon, 'percentOff' | 'maxDiscountCentavos'>): number {
  const price = Math.round(pricePhp * 100);
  return Math.max(0, Math.min(Math.floor((price * coupon.percentOff) / 100), coupon.maxDiscountCentavos, price - 1)) / 100;
}

@Injectable({ providedIn: 'root' })
export class RewardsService {
  private readonly api = inject(ApiService);
  readonly summary = signal<LoyaltySummary | null>(null);
  readonly available = computed(() => (this.summary()?.coupons ?? []).filter((c) => c.status === 'AVAILABLE'));

  async refresh(): Promise<void> {
    if (this.api.settings.useMockApi()) { this.summary.set(null); return; }
    this.summary.set(await this.api.get<LoyaltySummary>('/me/rewards'));
  }
}
