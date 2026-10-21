// orders
import { environment } from '../../../environments/environment';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { AddonQuote, AddonSku, Order, OrderStatus, PaymentMethod, ServiceSku } from '../../shared/models/domain.models';
import { buildMilestones, HelperSummary, StepMilestone } from '../../shared/models/ui.models';
import { roundCentavos, splitPayout } from '../../shared/utils/money';
import { SavedAddress } from './address.service';
import { DEMO_ADDRESS } from '../data/launch-city';
import { HELPERS, SKUS } from '../data/mock-data';
import { clearDemoState, loadDemoState, saveDemoState } from './demo-store';
import { LiveService } from './live.service';
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

export function isActiveOrderStatus(status: OrderStatus): boolean {
  return ['PENDING_ACCEPTANCE', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(status);
}

export function selectActiveBooking<T extends Pick<BookingDto, 'id' | 'status'>>(bookings: T[], currentBookingId: string): T | undefined {
  const current = bookings.find((booking) => booking.id === currentBookingId);
  if (current) return isActiveOrderStatus(current.status) ? current : undefined;
  return bookings.find((booking) => isActiveOrderStatus(booking.status));
}

const TRUST_FEE_PHP = 50;

function timeLabel(date?: Date): string | undefined {
  return date?.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

function minutesAgo(min: number): Date {
  return new Date(Date.now() - min * 60_000);
}

export interface OrderHistoryItem {
  id: string;
  title: string;
  helper: string;
  when: string;
  amountPhp: number;
  status: OrderStatus;
  bookingId?: string;
  canReview?: boolean;
  rating?: number | null;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly wallet = inject(WalletService);
  private readonly live = inject(LiveService);
  readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly community = inject(CommunityService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastController);
  readonly loading = signal(false);
  readonly error = signal('');
  private readonly mockHistory = signal<OrderHistoryItem[]>(
    PAST_ORDERS.map((p) => ({ ...p, status: 'COMPLETED' as OrderStatus }))
  );
  private readonly liveHistory = signal<OrderHistoryItem[]>([]);
  readonly history = computed(() => this.api.settings.useMockApi() ? this.mockHistory() : this.liveHistory());
  readonly travelBookings = signal<Pick<Order, 'id' | 'coordinates' | 'status' | 'expectedArrivalAt'>[]>([]);
  private revision = 0;
  private readonly imageCache=new Map<string,{url:string;until:number}>();
  private polling = false;
  private kept = '';
  private identity = '';

  private readonly stateMode = signal(this.api.settings.useMockApi());
  private readonly state = signal<Order>(this.loadOrder());
  readonly order = this.state.asReadonly();

  readonly approvedAddonsPhp = computed(() =>
    roundCentavos(this.state().addons.filter((a) => a.decision === 'APPROVED').reduce((sum, a) => sum + a.sku.pricePhp, 0)),
  );
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
  readonly isActive = computed(() => this.hasOrder() && isActiveOrderStatus(this.state().status));

  constructor() {
    const room = computed(() => this.api.settings.useMockApi() ? '' : `${this.auth.user()?.id ?? ''}:${this.order().id}`);
    effect((cleanup) => {
      const [userId,id] = room().split(':');
      if (!/^[0-9a-f-]{36}$/.test(userId ?? '') || !/^[0-9a-f-]{36}$/.test(id ?? '')) return;
      const stop = this.live.watch(`booking:${id}`);
      const subscription = this.live.events.subscribe((event) => {
        if (event.resource === `booking:${id}` && ['connected','status','addon'].includes(event.type)) {
          void this.load(id).catch(() => undefined);
          if (event.type === 'status' && this.auth.user()?.role === 'PRO') void this.wallet.refresh();
        }
      });
      cleanup(() => { subscription.unsubscribe(); stop(); });
    });
    const personal = computed(() => this.api.settings.useMockApi() ? '' : this.auth.user()?.id ?? '');
    effect((cleanup) => {
      const userId = personal();
      if (!/^[0-9a-f-]{36}$/.test(userId)) return;
      const stop = this.live.watch(`user:${userId}`);
      const subscription = this.live.events.subscribe((event) => {
        if (event.resource !== `user:${userId}`) return;
        if (event.type === 'connected') { void this.refresh(); return; }
        if (event.type !== 'booking' || !event.bookingId) return;
        if (event.message) { void this.announceMessage(event.bookingId, event.message.senderId); return; }
        if (event.bookingId === this.state().id) void this.load(event.bookingId).catch(() => undefined);
        void this.refresh();
        if (this.auth.user()?.role === 'PRO') void this.wallet.refresh();
      });
      cleanup(() => { subscription.unsubscribe(); stop(); });
    });
    effect(() => { if (this.api.settings.useMockApi() && this.stateMode()) saveDemoState('order', this.state()); });
    effect((cleanup) => {
      const user = this.auth.user();
      const mock = this.api.settings.useMockApi();
      const identity = `${mock}:${user?.id ?? ''}:${user?.role ?? ''}`;
      if (this.identity !== identity) {
        this.identity = identity; this.imageCache.clear(); this.revision++; this.stateMode.set(mock);
        this.state.set(mock ? this.loadOrder() : this.emptyOrder()); this.liveHistory.set([]); this.travelBookings.set([]);
      }
      if (mock) return;
      if (!user) return;
      const refresh = async () => {
        if (this.polling) return;
        this.polling = true;
        try { await this.refresh(); } finally { this.polling = false; }
      };
      void refresh();
      let last = Date.now();
      const timer = setInterval(() => {
        const live = this.live.connected().has(`user:${user.id}`);
        if (!live || Date.now() - last >= 30000) { last = Date.now(); void refresh(); }
      }, 5000);
      cleanup(() => clearInterval(timer));
    });
  }

  async book(paymentMethod: PaymentMethod, schedule: string, sku?: ServiceSku, helper?: HelperSummary, key: string = crypto.randomUUID(), window?: { scheduleStartAt: string; scheduleEndAt: string }, place?: SavedAddress, bulletinId?: string): Promise<void> {
    const user = this.auth.user();
    if (helper && user) {
      const isSelf = helper.id === user.id || (this.api.settings.useMockApi() && !!user.fullName && helper.name === user.fullName);
      if (isSelf) throw new Error('You cannot book your own service.');
    }
    if (!this.api.settings.useMockApi()) {
      if (!sku) throw new Error('Choose a catalog service.');
      if (!place) throw new Error('Choose and confirm your service address.');
      const { booking } = await this.api.post<{ booking: BookingDto }>('/bookings', {
        skuId: sku.id, address: { street: place.street, barangay: place.barangay, city: place.city, ...(place.landmark?.trim() ? { landmark: place.landmark.trim() } : {}) }, lat: place.lat, lng: place.lng,
        schedule: schedule.startsWith('Immediate') ? 'ASAP' : schedule, ...window, paymentMethod, ...(helper?.id ? { proId: helper.id } : {}), ...(bulletinId ? { bulletinId } : {}),
      }, { 'Idempotency-Key': key });
      await this.load(booking.id); return;
    }
    const now = new Date();
    this.state.update((o) => ({
      ...o,
      sku: sku ?? o.sku,
      helper: helper ?? o.helper,
      paymentMethod,
      ...(place ? { address: { street:place.street,barangay:place.barangay,city:place.city,landmark:place.landmark ?? '' },coordinates:[place.lat,place.lng] as const } : {}),
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
    this.mockHistory.update((hist) => [
      {
        id: o.code ?? o.id,
        title: o.sku.name,
        helper: o.helper.name,
        when: 'Today, ' + (timeLabel(new Date()) ?? 'just now'),
        amountPhp: this.escrowTotalPhp(),
        status: 'COMPLETED',
      },
      ...hist.filter((h) => h.id !== (o.code ?? o.id)),
    ]);
    this.wallet.credit(base, o.sku.name, `Order #${o.id} · Completed`);
    for (const a of addons) {
      this.wallet.credit(splitPayout(a.sku.pricePhp).proPhp, `Add-on: ${a.sku.name}`, `Order #${o.id}`);
    }
    return true;
  }

  readonly canResetDemo = computed(() => environment.demo && (this.api.settings.useMockApi() || this.auth.user()?.isDemo === true));

  async resetDemo(): Promise<void> {
    if (!this.canResetDemo()) return;
    if (!this.api.settings.useMockApi()) {
      const result = await this.api.post<{ booking: BookingDto }>('/demo/reset-order', {});
      await this.load(result.booking.id);
      await this.wallet.refresh();
      return;
    }
    clearDemoState();
    this.wallet.reset();
    this.mockHistory.set(PAST_ORDERS.map((p) => ({ ...p, status: 'COMPLETED' as OrderStatus })));
    this.state.set(this.seedOrder());
  }

  private loadOrder(): Order {
    if (!this.api.settings.useMockApi()) return this.emptyOrder();
    const saved = loadDemoState<Order>('order');
    if (!saved) return this.seedOrder();
    return saved.address.city === DEMO_ADDRESS.city ? saved : { ...saved, address: { ...DEMO_ADDRESS } };
  }

  keep(id: string): () => void {
    this.kept = id;
    return () => { if (this.kept === id) this.kept = ''; };
  }

  async load(id: string): Promise<void> {
    if (this.api.settings.useMockApi()) return;
    const revision = ++this.revision;
    const [,result]=await Promise.all([this.community.catalog(),this.api.get<{ booking:BookingDto }>(`/bookings/${id}`)]);
    const {booking}=result;
    const order = await this.fromApi(booking);
    if (revision === this.revision) { this.rememberTravel(booking); this.state.set(order); void this.hydrateImages(booking,revision); }
  }

  async refresh(): Promise<void> {
    if (this.api.settings.useMockApi() || !this.auth.user()) return;
    const revision = ++this.revision;
    this.loading.set(true);
    try {
      await this.community.catalog();
      const result = await this.api.get<{ bookings: BookingDto[] }>('/bookings', { role: this.auth.user()?.role === 'PRO' ? 'pro' : 'customer', limit: 100 });
      if (revision !== this.revision) return;
      this.travelBookings.set(this.auth.user()?.role === 'PRO' ? result.bookings.filter((b) => b.status === 'EN_ROUTE' && b.proId === this.auth.user()?.id).map((b) => ({ id: b.id, status: b.status, coordinates: [b.lat,b.lng] as const, expectedArrivalAt: b.expectedArrivalAt })) : []);
      this.liveHistory.set(result.bookings.filter((b) => ['COMPLETED', 'CANCELLED'].includes(b.status)).map((b) => ({ id: b.code, title: b.skuName,
        helper: b.pro?.name ?? 'SERVIO Pro', when: new Date(b.events[b.events.length - 1]?.createdAt ?? Date.now()).toLocaleDateString('en-PH'),
        status: b.status, bookingId: b.id, rating: b.reviewRating ?? null,
        canReview: b.status === 'COMPLETED' && b.customerId === this.auth.user()?.id && !b.reviewed,
        amountPhp: (b.priceCentavos + b.trustFeeCentavos + b.addons.filter((a) => a.decision === 'APPROVED').reduce((sum,a) => sum + a.priceCentavos,0) + b.tipCentavos) / 100 })));
      const selected = (this.kept && this.kept === this.state().id ? result.bookings.find((b) => b.id === this.kept) : undefined) ?? selectActiveBooking(result.bookings, this.state().id);
      const order = selected ? await this.fromApi(selected) : this.emptyOrder();
      if (revision === this.revision) { this.state.set(order); this.error.set(''); if(selected)void this.hydrateImages(selected,revision); }
    } catch (error) { if (revision === this.revision) this.error.set(error instanceof Error ? error.message : 'Could not load bookings.'); }
    finally { this.loading.set(false); }
  }

  private rememberTravel(booking: BookingDto): void {
    if (this.auth.user()?.role !== 'PRO' || booking.proId !== this.auth.user()?.id) return;
    this.travelBookings.update((current) => {
      const rest = current.filter((b) => b.id !== booking.id);
      return booking.status === 'EN_ROUTE' ? [...rest, { id: booking.id, status: booking.status, coordinates: [booking.lat,booking.lng] as const, expectedArrivalAt: booking.expectedArrivalAt }] : rest;
    });
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
    const { booking } = await this.api.post<{ booking: BookingDto }>(`/bookings/${this.state().id}/verify-pin`, { pin });
    if (this.state().id === booking.id) { const order = await this.fromApi(booking); if (this.state().id === booking.id) this.state.set(order); }
    void this.auth.refreshProfile(true).catch(() => undefined); void this.wallet.refresh().catch(() => undefined);
    return booking.escrow === 'COMPLETED';
  }

  async cancel(reason: string): Promise<void> {
    if (this.api.settings.useMockApi()) {
      const o = this.state();
      this.state.update((cur) => ({
        ...cur,
        status: 'CANCELLED',
        escrow: 'REFUNDED',
        statusTimes: { ...cur.statusTimes, CANCELLED: new Date() },
      }));
      this.mockHistory.update((hist) => [
        {
          id: o.code ?? o.id,
          title: o.sku.name,
          helper: o.helper.name,
          when: 'Today, ' + (timeLabel(new Date()) ?? 'just now'),
          amountPhp: this.escrowTotalPhp(),
          status: 'CANCELLED',
        },
        ...hist.filter((h) => h.id !== (o.code ?? o.id)),
      ]);
      this.state.set(this.emptyOrder());
      return;
    }
    await this.api.post(`/bookings/${this.state().id}/status`, { to: 'CANCELLED', reason });
    await this.refresh();
  }

  async review(rating: number, compliments: string[], body: string, tipPhp: number): Promise<void> {
    if (this.api.settings.useMockApi()) { this.setTip(tipPhp); return; }
    await this.api.post(`/bookings/${this.state().id}/review`, { rating, compliments, ...(body.trim() ? { body: body.trim() } : {}), tipCentavos: Math.round(tipPhp * 100) });
    await this.load(this.state().id);
    void this.refresh();
  }

  private async announceMessage(bookingId: string, senderId: string | null): Promise<void> {
    if (!senderId || senderId === this.auth.user()?.id || this.router.url.startsWith(`/order/${bookingId}/chat`)) return;
    const toast = await this.toasts.create({ message: 'New message on your booking.', duration: 3000, position: 'top',
      buttons: [{ text: 'Open', handler: () => { void this.router.navigateByUrl(`/order/${bookingId}/chat`); } }] });
    await toast.present();
  }

  private async fromApi(b: BookingDto): Promise<Order> {
    const sku = this.community.skus().find((s) => s.id === b.skuId);
    const helper = this.community.helpers().find((p) => p.id === b.proId);
    const providerName = b.pro?.name ?? helper?.name ?? 'Finding a Pro';
    const customerName = b.customer?.name ?? 'Customer';
    const resetIndex = b.events.reduce((last, e, i) => e.note?.startsWith('DEMO_RESET:') ? i : last, -1);
    const currentEvents = resetIndex >= 0 ? b.events.slice(resetIndex) : b.events;
    return {
      id: b.id, coordinates: [b.lat, b.lng], code: b.code, customerId: b.customerId, expectedArrivalAt: b.expectedArrivalAt, reviewed: b.reviewed,
      sku: { ...(sku ?? this.emptyOrder().sku), id: b.skuId, name: b.skuName, pricePhp: b.priceCentavos / 100 },
      helper: { ...(helper ?? this.emptyOrder().helper), id: b.proId ?? '', name: providerName,
        avatarUrl: this.state().helper.id===b.proId ? this.state().helper.avatarUrl : '', rating: b.pro?.rating ?? helper?.rating ?? 0, reviewCount: b.pro?.ratingCount ?? helper?.reviewCount ?? 0 },
      customerName, customerAvatarUrl: this.state().customerId===b.customerId ? this.state().customerAvatarUrl : '',
      address: { ...b.address, landmark: b.address.landmark ?? '' }, schedule: b.schedule === 'ASAP' ? 'Immediate / ASAP' : b.schedule,
      paymentMethod: b.paymentMethod, trustFeePhp: b.trustFeeCentavos / 100, status: b.status, escrow: b.escrow,
      completionPin: b.completionPin ?? '', tipPhp: b.tipCentavos / 100,
      statusTimes: Object.fromEntries(currentEvents.map((e) => [e.status, new Date(e.createdAt)])),
      addons: b.addons.map((a) => ({ id: a.id, sku: { id: a.addonSkuId, name: a.addonName, pricePhp: a.priceCentavos / 100, detail: '' },
        photoUrl: this.state().id===b.id ? this.state().addons.find(old=>old.id===a.id)?.photoUrl ?? '' : '', note: a.note, createdAt: new Date(a.createdAt), decision: a.decision })),
    };
  }

  private async hydrateImages(booking:BookingDto,revision:number):Promise<void>{
    const identity=this.identity;
    const image=async(key:string|null):Promise<string>=>{
      if(!key)return '';
      const cached=this.imageCache.get(key);if(cached && cached.until>Date.now())return cached.url;
      const url=await this.community.image(key).catch(()=>'');
      if(url && identity===this.identity)this.imageCache.set(key,{url,until:Date.now()+45000});return url;
    };
    const [helper,customer,addons]=await Promise.all([image(booking.pro?.avatarKey??null),image(booking.customer?.avatarKey??null),Promise.all(booking.addons.map(a=>image(a.photoKey)))]);
    if(revision!==this.revision||identity!==this.identity||this.state().id!==booking.id)return;
    this.state.update(order=>({...order,helper:{...order.helper,avatarUrl:helper},customerAvatarUrl:customer,addons:order.addons.map(a=>({...a,photoUrl:addons[booking.addons.findIndex(b=>b.id===a.id)]??a.photoUrl}))}));
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
