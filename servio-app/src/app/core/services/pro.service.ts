import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../api/api.service';
import { ApiFailure } from '../api/api.interceptor';
import { AuthService } from './auth.service';
import { OrderService } from './order.service';
import { LiveService } from './live.service';
import { TrackingService } from './tracking.service';
import { WalletService } from './wallet.service';

export interface DispatchOffer {
  id: string; expiresAt: string; distanceM: number;
  booking: { id: string; code: string; skuName: string; priceCentavos: number; trustFeeCentavos: number; barangay: string; city: string };
}

@Injectable({ providedIn: 'root' })
export class ProService {
  readonly api = inject(ApiService);
  readonly tracking = inject(TrackingService);
  private readonly live = inject(LiveService);
  private lastDemoAvailability = 0;
  readonly auth = inject(AuthService);
  private readonly orders = inject(OrderService);
  private readonly wallet = inject(WalletService);
  private readonly router = inject(Router);
  readonly offer = signal<DispatchOffer | null>(null);
  readonly serverOffsetMs = signal(0);
  readonly online = computed(() => this.api.settings.useMockApi() ? this.mockOnline() : this.auth.pro()?.isOnline ?? false);
  private readonly mockOnline = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  private polling = false;
  private deniedProUserId: string | null = null;

  constructor() {
    const room = computed(() => this.api.settings.useMockApi() || this.auth.user()?.role !== 'PRO' ? '' : this.auth.user()?.id ?? '');
    effect((cleanup) => {
      const userId=room(); if (!/^[0-9a-f-]{36}$/.test(userId)) return;
      const stop=this.live.watch(`pro:${userId}`);
      const subscription=this.live.events.subscribe((event) => { if(event.resource===`pro:${userId}` && ['connected','dispatch'].includes(event.type)) void this.poll(); });
      cleanup(()=>{ subscription.unsubscribe(); stop(); });
    });
    effect((cleanup) => {
      const user = this.auth.user(); const mock = this.api.settings.useMockApi();
      if (user?.role !== 'PRO') this.deniedProUserId = null;
      this.offer.set(null);
      if (mock || user?.role !== 'PRO') return;
      void this.poll();
      const timer = setInterval(() => void this.poll(), 3000);
      cleanup(() => clearInterval(timer));
    });
  }
  async poll(): Promise<void> {
    if (this.polling || this.auth.user()?.role !== 'PRO' || this.deniedProUserId === this.auth.user()?.id) return;
    this.polling = true;
    const userId = this.auth.user()!.id;
    try {
      if(this.online() && this.tracking.mode()==='sim' && Date.now()-this.lastDemoAvailability>30000) {
        this.lastDemoAvailability=Date.now();
        await this.api.post('/pro/location',await this.tracking.currentLocation());
      }
      const result = await this.api.post<{ offer: DispatchOffer | null; serverNow: string }>('/pro/dispatch', {});
      if (this.auth.user()?.id !== userId) return;
      const previous = this.offer()?.id;
      this.serverOffsetMs.set(Date.parse(result.serverNow) - Date.now()); this.offer.set(result.offer); this.error.set('');
      if (result.offer && result.offer.id !== previous && this.router.url === '/pro') await this.router.navigateByUrl('/pro/radar-alert');
      await this.wallet.refresh();
    } catch (error) {
      if (error instanceof ApiFailure && error.code === 'PRO_REQUIRED') this.deniedProUserId = userId;
      this.error.set(error instanceof Error ? error.message : 'Could not receive jobs.');
    }
    finally { this.polling = false; }
  }
  async availability(online: boolean): Promise<void> {
    if (this.saving()) return;
    if (this.api.settings.useMockApi()) { this.mockOnline.set(online); return; }
    this.saving.set(true); this.error.set('');
    try {
      let location: { lat: number; lng: number } | undefined;
      if (online) {
        location = await this.tracking.currentLocation();
      }
      const result = await this.api.post<{ pro: NonNullable<ReturnType<AuthService['pro']>> }>('/pro/availability', { online, ...location });
      this.auth.pro.set(result.pro); await this.poll();
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Location is required to receive nearby jobs.'); }
    finally { this.saving.set(false); }
  }
  async accept(id = this.offer()?.id): Promise<string> {
    if (!id) throw new Error('No active offer.');
    const { bookingId } = await this.api.post<{ bookingId: string }>(`/offers/${id}/accept`, {});
    if (this.offer()?.id === id) this.offer.set(null); await this.orders.load(bookingId); await this.wallet.refresh(); return bookingId;
  }
  async decline(id = this.offer()?.id): Promise<void> {
    if (!id) return;
    await this.api.post(`/offers/${id}/decline`, {}); if (this.offer()?.id === id) this.offer.set(null);
  }
}
