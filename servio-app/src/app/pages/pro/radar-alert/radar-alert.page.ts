import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { DispatchAlertService } from '../../../core/services/dispatch-alert.service';
import { ProService } from '../../../core/services/pro.service';
import { splitPayout } from '../../../shared/utils/money';
import { OrderService } from '../../../core/services/order.service';
import { PhpPipe } from '../../../shared/pipes/php.pipe';

export const RADAR_WINDOW_S = 60;
const RING_R = 92;
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

@Component({
  selector: 'app-radar-alert',
  templateUrl: 'radar-alert.page.html',
  styleUrl: 'radar-alert.page.scss',
  imports: [IonContent, IonIcon, PhpPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RadarAlertPage implements OnDestroy {
  private readonly alert = inject(DispatchAlertService);
  private readonly router = inject(Router);
  readonly orders = inject(OrderService);

  readonly pro = inject(ProService);
  readonly incoming = this.pro.offer();
  readonly saving = signal(false);
  readonly error = signal('');
  readonly title = computed(() => this.pro.api.settings.useMockApi() ? this.orders.order().sku.name : this.incoming?.booking.skuName ?? 'Offer unavailable');
  readonly area = computed(() => { const o = this.incoming; return o ? `${o.booking.barangay}, ${o.booking.city} (${(o.distanceM / 1000).toFixed(1)} km away)` : this.orders.order().address.barangay + ', ' + this.orders.order().address.city; });
  readonly payout = computed(() => this.pro.api.settings.useMockApi() ? this.orders.basePayout().proPhp : splitPayout((this.incoming?.booking.priceCentavos ?? 0) / 100).proPhp);
  readonly total = computed(() => this.pro.api.settings.useMockApi() ? this.orders.escrowTotalPhp() : ((this.incoming?.booking.priceCentavos ?? 0) + (this.incoming?.booking.trustFeeCentavos ?? 0)) / 100);
  private duration = RADAR_WINDOW_S * 1000;
  readonly ringR = RING_R;
  readonly circumference = RING_CIRCUMFERENCE;
  readonly secondsLeft = signal(RADAR_WINDOW_S);
  /** 0..1 elapsed fraction, updated every animation frame for a smooth ring. */
  readonly elapsed = signal(0);
  readonly expired = signal(false);
  readonly dashOffset = computed(() => this.circumference * this.elapsed());
  readonly urgent = computed(() => this.secondsLeft() <= 10);

  private startedAt = 0;
  private frame = 0;
  private done = false;

  ionViewDidEnter(): void {
    this.done = false;
    this.expired.set(false);
    this.duration = this.pro.api.settings.useMockApi() ? RADAR_WINDOW_S * 1000 : Math.max(0, Date.parse(this.incoming?.expiresAt ?? '') - Date.now() - this.pro.serverOffsetMs());
    if (!Number.isFinite(this.duration)) this.duration = 0;
    this.startedAt = performance.now();
    this.alert.startUrgentRadarAlert();
    this.tick();
  }

  ionViewWillLeave(): void {
    this.teardown();
  }

  ngOnDestroy(): void {
    this.teardown();
  }

  private tick = (): void => {
    const t = Math.min(1, (performance.now() - this.startedAt) / Math.max(1, this.duration));
    this.elapsed.set(t);
    this.secondsLeft.set(Math.max(0, Math.ceil(this.duration / 1000 * (1 - t))));
    if (t >= 1) {
      this.teardown();
      this.expired.set(true);
      return;
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  async accept(): Promise<void> {
    if (this.done || this.saving()) return;
    this.saving.set(true); this.error.set('');
    try {
      let id = this.orders.order().id;
      if (this.pro.api.settings.useMockApi()) { const o = this.orders.order(); await this.orders.book(o.paymentMethod, o.schedule); }
      else id = await this.pro.accept(this.incoming?.id);
      this.teardown(); await this.router.navigate(['/pro/order', id, 'execute'], { replaceUrl: true });
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Could not accept job.'); }
    finally { this.saving.set(false); }
  }

  async decline(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try { if (!this.pro.api.settings.useMockApi() && !this.expired()) await this.pro.decline(this.incoming?.id); this.teardown(); await this.router.navigateByUrl('/pro', { replaceUrl: true }); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Could not decline offer.'); }
    finally { this.saving.set(false); }
  }

  private teardown(): void {
    this.done = true;
    cancelAnimationFrame(this.frame);
    this.alert.stopUrgentRadarAlert();
  }
}
