import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { AddonQuote, AddonSku, Order, OrderStatus, PaymentMethod, ServiceSku } from '../../shared/models/domain.models';
import { buildMilestones, HelperSummary, StepMilestone } from '../../shared/models/ui.models';
import { roundCentavos, splitPayout } from '../../shared/utils/money';
import { DEMO_ADDRESS } from '../data/launch-city';
import { HELPERS, SKUS } from '../data/mock-data';
import { clearDemoState, loadDemoState, saveDemoState } from './demo-store';
import { WalletService } from './wallet.service';
import { ApiService } from '../api/api.service';
import { BookingDto } from '../api/customer.models';
import { AuthService } from './auth.service';
import { CommunityService } from './community.service';
import { PAST_ORDERS } from '../data/mock-data';

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
  readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly community = inject(CommunityService);
  readonly loading = signal(false);
  readonly error = signal('');
  private readonly liveHistory = signal<{ id: string; title: string; helper: string; when: string; amountPhp: number }[]>([]);
  readonly history = computed(() => this.api.settings.useMockApi() ? PAST_ORDERS : this.liveHistory());
  private revision = 0;
  private polling = false;
  private identity = '';

  private readonly stateMode = signal(this.api.settings.useMockApi());
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
  readonly proPayoutPhp = computed(() => splitPayout(this.serviceGrossPhp()).proPhp);
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

  readonly hasOrder = computed(() => !!this.state().id);
  readonly isActive = computed(() => this.hasOrder() && !['COMPLETED', 'CANCELLED'].includes(this.state().status));

  constructor() {
    effect(() => { if (this.api.settings.useMockApi() && this.stateMode()) saveDemoState('order', this.state()); });
    effect((cleanup) => {
      const user = this.auth.user();
      const mock = this.api.settings.useMockApi();
      const identity = `${mock}:${user?.id ?? ''}:${user?.role ?? ''}`;
      if (this.identity !== identity) {
        this.identity = identity; this.revision++; this.stateMode.set(mock);
        this.state.set(mock ? this.loadOrder() : this.emptyOrder()); this.liveHistory.set([]);
      }
      if (mock) return;
      if (!user) return;
      const refresh = async () => {
        if (this.polling) return;
        this.polling = true;
        try { await this.refresh(); } finally { this.polling = false; }
      };
      void refresh();
      const timer = setInterval(() => void refresh(), 4000);
      cleanup(() => clearInterval(timer));
    });
  }

  /** Checkout: authorize a fresh escrow hold and dispatch. */
  async book(paymentMethod: PaymentMethod, schedule: string, sku?: ServiceSku, helper?: HelperSummary, key: string = crypto.randomUUID(), window?: { scheduleStartAt: string; scheduleEndAt: string }): Promise<void> {
    if (!this.api.settings.useMockApi()) {
      if (!sku) throw new Error('Choose a catalog service.');
      const { booking } = await this.api.post<{ booking: BookingDto }>('/bookings', {
        skuId: sku.id, address: { ...DEMO_ADDRESS }, lat: 17.618111, lng: 121.718927,
        schedule: schedule.startsWith('Immediate') ? 'ASAP' : schedule, ...window, paymentMethod, ...(helper?.id ? { proId: helper.id } : {}),
      }, { 'Idempotency-Key': key });
      await this.load(booking.id); return;
    }
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
    if (!this.api.settings.useMockApi()) throw new Error('Use the API to change a live booking status.');
    this.state.update((o) => {
      if (o.status === status) return o;
      return { ...o, status, statusTimes: { ...o.statusTimes, [status]: new Date() } };
    });
  }

  /** Pro side — ADR-004: photo evidence + standardized part, awaiting customer approval. */
  pushAddonQuote(sku: AddonSku, photoUrl: string, note: string): AddonQuote {
    if (!this.api.settings.useMockApi()) throw new Error('Upload evidence and request the add-on through the API.');
    const quote: AddonQuote = { id: `addon-${Date.now()}`, sku, photoUrl, note, createdAt: new Date(), decision: 'PENDING' };
    this.state.update((o) => ({ ...o, addons: [...o.addons.filter((a) => a.decision !== 'PENDING'), quote] }));
    return quote;
  }

  async decideAddon(id: string, approve: boolean): Promise<void> {
    if (!this.api.settings.useMockApi()) {
      await this.api.post(`/bookings/${this.state().id}/addons/${id}/decision`, { approve });
      await this.load(this.state().id); return;
    }
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
    if (!this.api.settings.useMockApi()) return false;
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
    if (!this.api.settings.useMockApi()) return; // D3 supplies the guarded server reset.
    clearDemoState();
    this.wallet.reset();
    this.state.set(this.seedOrder());
  }

  private loadOrder(): Order {
    if (!this.api.settings.useMockApi()) return this.emptyOrder();
    const saved = loadDemoState<Order>('order');
    if (!saved) return this.seedOrder();
    // Migrate cached prototype addresses without losing escrow or lifecycle progress.
    return saved.address.city === DEMO_ADDRESS.city ? saved : { ...saved, address: { ...DEMO_ADDRESS } };
  }

  async load(id: string): Promise<void> {
    if (this.api.settings.useMockApi()) return;
    const revision = ++this.revision;
    await this.community.catalog();
    const { booking } = await this.api.get<{ booking: BookingDto }>(`/bookings/${id}`);
    const order = await this.fromApi(booking);
    if (revision === this.revision) this.state.set(order);
  }

  async refresh(): Promise<void> {
    if (this.api.settings.useMockApi() || !this.auth.user()) return;
    const revision = ++this.revision;
    this.loading.set(true);
    try {
      await this.community.catalog();
      const result = await this.api.get<{ bookings: BookingDto[] }>('/bookings', { role: this.auth.user()?.role === 'PRO' ? 'pro' : 'customer', limit: 100 });
      if (revision !== this.revision) return;
      this.liveHistory.set(result.bookings.filter((b) => b.status === 'COMPLETED').map((b) => ({ id: b.code, title: b.skuName,
        helper: b.pro?.name ?? 'SERVIO Pro', when: new Date(b.events[b.events.length - 1]?.createdAt ?? Date.now()).toLocaleDateString('en-PH'),
        amountPhp: (b.priceCentavos + b.trustFeeCentavos + b.addons.filter((a) => a.decision === 'APPROVED').reduce((sum,a) => sum + a.priceCentavos,0) + b.tipCentavos) / 100 })));
      const current = result.bookings.find((b) => b.id === this.state().id);
      const selected = current ?? result.bookings.find((b) => !['COMPLETED','CANCELLED'].includes(b.status)) ?? result.bookings[0];
      const order = selected ? await this.fromApi(selected) : this.emptyOrder();
      if (revision === this.revision) { this.state.set(order); this.error.set(''); }
    } catch (error) { if (revision === this.revision) this.error.set(error instanceof Error ? error.message : 'Could not load bookings.'); }
    finally { this.loading.set(false); }
  }

  async advance(status: OrderStatus): Promise<void> {
    if (this.api.settings.useMockApi()) { this.setStatus(status); return; }
    await this.api.post(`/bookings/${this.state().id}/status`, { to: status }); await this.load(this.state().id);
  }
  async quote(sku: AddonSku, photoUrl: string, note: string): Promise<void> {
    if (this.api.settings.useMockApi()) { this.pushAddonQuote(sku, photoUrl, note); return; }
    const blob = await (await fetch(photoUrl)).blob();
    const photoKey = await this.api.upload(blob, 'addon_evidence');
    await this.api.post(`/bookings/${this.state().id}/addons`, { addonSkuId: sku.id, photoKey, note }); await this.load(this.state().id);
  }
  async complete(pin: string): Promise<boolean> {
    if (this.api.settings.useMockApi()) return this.verifyCompletionPin(pin);
    await this.api.post(`/bookings/${this.state().id}/verify-pin`, { pin }); await this.load(this.state().id); await this.auth.refreshProfile(true); await this.wallet.refresh();
    return this.state().escrow === 'COMPLETED';
  }

  async cancel(reason: string): Promise<void> {
    if (this.api.settings.useMockApi()) { this.setStatus('CANCELLED'); return; }
    await this.api.post(`/bookings/${this.state().id}/status`, { to: 'CANCELLED', reason });
    await this.load(this.state().id);
  }

  async review(rating: number, compliments: string[], body: string, tipPhp: number): Promise<void> {
    if (this.api.settings.useMockApi()) { this.setTip(tipPhp); return; }
    await this.api.post(`/bookings/${this.state().id}/review`, { rating, compliments, ...(body.trim() ? { body: body.trim() } : {}), tipCentavos: Math.round(tipPhp * 100) });
    await this.load(this.state().id);
  }

  private async fromApi(b: BookingDto): Promise<Order> {
    const sku = this.community.skus().find((s) => s.id === b.skuId);
    const helper = this.community.helpers().find((p) => p.id === b.proId);
    return {
      id: b.id, code: b.code, customerId: b.customerId, expectedArrivalAt: b.expectedArrivalAt, reviewed: b.reviewed,
      sku: { ...(sku ?? this.emptyOrder().sku), id: b.skuId, name: b.skuName, pricePhp: b.priceCentavos / 100 },
      helper: { ...(helper ?? this.emptyOrder().helper), id: b.proId ?? '', name: b.pro?.name ?? 'Finding a Pro',
        avatarUrl: await this.community.image(b.pro?.avatarKey ?? null), rating: b.pro?.rating ?? 0, reviewCount: b.pro?.ratingCount ?? 0 },
      customerName: b.customer?.name ?? 'Customer', customerAvatarUrl: await this.community.image(b.customer?.avatarKey ?? null),
      address: { ...b.address, landmark: b.address.landmark ?? '' }, schedule: b.schedule === 'ASAP' ? 'Immediate / ASAP' : b.schedule,
      paymentMethod: b.paymentMethod, trustFeePhp: b.trustFeeCentavos / 100, status: b.status, escrow: b.escrow,
      completionPin: b.completionPin ?? '', tipPhp: b.tipCentavos / 100,
      statusTimes: Object.fromEntries(b.events.map((e) => [e.status, new Date(e.createdAt)])),
      addons: await Promise.all(b.addons.map(async (a) => ({ id: a.id, sku: { id: a.addonSkuId, name: a.addonName, pricePhp: a.priceCentavos / 100, detail: '' },
        photoUrl: await this.community.image(a.photoKey), note: a.note, createdAt: new Date(a.createdAt), decision: a.decision }))),
    };
  }

  private emptyOrder(): Order {
    return { id: '', sku: { id: '', name: '', category: 'repairs', pricePhp: 0, unit: 'job', durationLabel: '', inclusions: [] },
      helper: { id: '', name: 'Finding a Pro', avatarUrl: '', category: '', rating: 0, reviewCount: 0, distanceKm: 0, hourlyRatePhp: 0, isAvailable: false },
      customerName: '', customerAvatarUrl: '', address: { ...DEMO_ADDRESS }, schedule: 'Immediate / ASAP', paymentMethod: 'GCASH',
      trustFeePhp: 0, addons: [], status: 'PENDING_ACCEPTANCE', escrow: 'NONE', completionPin: '', tipPhp: 0, statusTimes: {} };
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
