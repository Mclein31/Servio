import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { AddonQuote, AddonSku, Order, OrderStatus, PaymentMethod, ServiceSku } from '../../shared/models/domain.models';
import { buildMilestones, HelperSummary, StepMilestone } from '../../shared/models/ui.models';
import { roundCentavos, splitPayout } from '../../shared/utils/money';
import { DEMO_ADDRESS } from '../data/launch-city';
import { HELPERS, SKUS } from '../data/mock-data';
import { clearDemoState, loadDemoState, saveDemoState } from './demo-store';
import { WalletService } from './wallet.service';

const ORDER_STEP_INDEX: Record<OrderStatus, number> = {
  PENDING_ACCEPTANCE: 0,
  ACCEPTED: 1,
  EN_ROUTE: 2,
  ARRIVED: 3,
  IN_PROGRESS: 3,
  COMPLETED: 4,
  CANCELLED: 0,
};

const TRUST_FEE_PHP = 50;

function timeLabel(date?: Date): string | undefined {
  return date?.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

function minutesAgo(min: number): Date {
  return new Date(Date.now() - min * 60_000);
}

/**
 * Single source of truth for the demo's active booking (#SRV-8821). Both the
 * customer screens and the Servio Pro screens read and drive this order, so
 * the escrow lifecycle (ADR-002) can be walked end to end on one device.
 */
@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly wallet = inject(WalletService);

  private readonly state = signal<Order>(this.loadOrder());
  readonly order = this.state.asReadonly();

  readonly approvedAddonsPhp = computed(() =>
    roundCentavos(this.state().addons.filter((a) => a.decision === 'APPROVED').reduce((sum, a) => sum + a.sku.pricePhp, 0)),
  );
  /** Gross service value held for the Pro split (base SKU + approved add-ons). */
  readonly serviceGrossPhp = computed(() => roundCentavos(this.state().sku.pricePhp + this.approvedAddonsPhp()));
  readonly escrowTotalPhp = computed(() => roundCentavos(this.serviceGrossPhp() + this.state().trustFeePhp));
  readonly basePayout = computed(() => splitPayout(this.state().sku.pricePhp));
  readonly addonPayoutPhp = computed(() =>
    roundCentavos(
      this.state()
        .addons.filter((a) => a.decision === 'APPROVED')
        .reduce((sum, a) => sum + splitPayout(a.sku.pricePhp).proPhp, 0),
    ),
  );
  readonly proPayoutPhp = computed(() => roundCentavos(this.basePayout().proPhp + this.addonPayoutPhp()));
  readonly pendingAddon = computed(() => this.state().addons.find((a) => a.decision === 'PENDING') ?? null);

  readonly milestones = computed<StepMilestone[]>(() => {
    const o = this.state();
    const t = o.statusTimes;
    return buildMilestones(ORDER_STEP_INDEX[o.status], undefined, [
      timeLabel(t.PENDING_ACCEPTANCE),
      timeLabel(t.ACCEPTED),
      timeLabel(t.EN_ROUTE),
      timeLabel(t.ARRIVED),
      timeLabel(t.COMPLETED),
    ]);
  });

  readonly isActive = computed(() => !['COMPLETED', 'CANCELLED'].includes(this.state().status));

  constructor() {
    effect(() => saveDemoState('order', this.state()));
  }

  /** Checkout: authorize a fresh escrow hold and dispatch. */
  book(paymentMethod: PaymentMethod, schedule: string, sku?: ServiceSku, helper?: HelperSummary): void {
    const now = new Date();
    this.state.update((o) => ({
      ...o,
      sku: sku ?? o.sku,
      helper: helper ?? o.helper,
      paymentMethod,
      schedule,
      addons: [],
      tipPhp: 0,
      escrow: 'HOLD_AUTHORIZED',
      status: 'ACCEPTED',
      statusTimes: { PENDING_ACCEPTANCE: now, ACCEPTED: now },
    }));
  }

  setStatus(status: OrderStatus): void {
    this.state.update((o) => {
      if (o.status === status) return o;
      return { ...o, status, statusTimes: { ...o.statusTimes, [status]: new Date() } };
    });
  }

  /** Pro side — ADR-004: photo evidence + standardized part, awaiting customer approval. */
  pushAddonQuote(sku: AddonSku, photoUrl: string, note: string): AddonQuote {
    const quote: AddonQuote = { id: `addon-${Date.now()}`, sku, photoUrl, note, createdAt: new Date(), decision: 'PENDING' };
    this.state.update((o) => ({ ...o, addons: [...o.addons.filter((a) => a.decision !== 'PENDING'), quote] }));
    return quote;
  }

  decideAddon(id: string, approve: boolean): void {
    this.state.update((o) => ({
      ...o,
      addons: o.addons.map((a) => (a.id === id ? { ...a, decision: approve ? 'APPROVED' : 'DECLINED' } : a)),
    }));
  }

  setTip(tipPhp: number): void {
    this.state.update((o) => ({ ...o, tipPhp: Math.max(0, roundCentavos(tipPhp)) }));
  }

  /**
   * Pro enters the customer's PIN. Only a matching PIN moves escrow
   * HOLD_AUTHORIZED → COMPLETED and credits the Pro wallet (ADR-002).
   */
  verifyCompletionPin(pin: string): boolean {
    const o = this.state();
    if (o.escrow !== 'HOLD_AUTHORIZED' || pin !== o.completionPin) return false;

    const base = this.basePayout().proPhp;
    const addons = o.addons.filter((a) => a.decision === 'APPROVED');
    this.state.update((cur) => ({
      ...cur,
      escrow: 'COMPLETED',
      status: 'COMPLETED',
      statusTimes: { ...cur.statusTimes, COMPLETED: new Date() },
    }));
    this.wallet.credit(base, o.sku.name, `Order #${o.id} · Completed`);
    for (const a of addons) {
      this.wallet.credit(splitPayout(a.sku.pricePhp).proPhp, `Add-on: ${a.sku.name}`, `Order #${o.id}`);
    }
    return true;
  }

  /** Demo helper: restore the mid-route state shown in the approved mockups. */
  resetDemo(): void {
    clearDemoState();
    this.wallet.reset();
    this.state.set(this.seedOrder());
  }

  private loadOrder(): Order {
    const saved = loadDemoState<Order>('order');
    if (!saved) return this.seedOrder();
    // Migrate cached prototype addresses without losing escrow or lifecycle progress.
    return saved.address.city === DEMO_ADDRESS.city ? saved : { ...saved, address: { ...DEMO_ADDRESS } };
  }

  private seedOrder(): Order {
    const daniel = HELPERS.find((h) => h.id === 'daniel')!;
    return {
      id: 'SRV-8821',
      sku: SKUS['acLeak'],
      helper: daniel,
      customerName: 'Sophia M.',
      customerAvatarUrl: 'assets/avatars/sophia.png',
      address: { ...DEMO_ADDRESS },
      schedule: 'Immediate / ASAP',
      paymentMethod: 'GCASH',
      trustFeePhp: TRUST_FEE_PHP,
      addons: [],
      status: 'EN_ROUTE',
      escrow: 'HOLD_AUTHORIZED',
      completionPin: '7492',
      tipPhp: 0,
      statusTimes: { PENDING_ACCEPTANCE: minutesAgo(11), ACCEPTED: minutesAgo(7), EN_ROUTE: minutesAgo(1) },
    };
  }
}
