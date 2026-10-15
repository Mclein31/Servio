import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { DispatchAlertService } from '../../../core/services/dispatch-alert.service';
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
    const t = Math.min(1, (performance.now() - this.startedAt) / (RADAR_WINDOW_S * 1000));
    this.elapsed.set(t);
    this.secondsLeft.set(Math.max(0, Math.ceil(RADAR_WINDOW_S * (1 - t))));
    if (t >= 1) {
      this.teardown();
      this.expired.set(true);
      return;
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  accept(): void {
    if (this.done) return;
    this.teardown();
    const o = this.orders.order();
    this.orders.book(o.paymentMethod, o.schedule);
    this.router.navigate(['/pro/order', o.id, 'execute'], { replaceUrl: true });
  }

  decline(): void {
    this.teardown();
    this.router.navigateByUrl('/pro', { replaceUrl: true });
  }

  private teardown(): void {
    this.done = true;
    cancelAnimationFrame(this.frame);
    this.alert.stopUrgentRadarAlert();
  }
}
