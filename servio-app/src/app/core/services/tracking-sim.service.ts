import { computed, effect, inject, Injectable, NgZone, OnDestroy, signal, untracked } from '@angular/core';
import { RouteSample, RouteTrack } from '../../shared/utils/route-track';
import { TUGUEGARAO_ROUTE } from '../data/tuguegarao-route';
import { OrderService } from './order.service';

interface Fix {
  /** Metres travelled along the route at this GPS fix. */
  distance: number;
  /** performance.now() when the fix arrived. */
  at: number;
}

/** Remaining distance when the demo order is "On the Way": matches the 12 min / 1.4 km mockup. */
const START_REMAINING_M = 1400;
/** City-traffic pace implied by 1.4 km in 12 min. ETAs are computed from this nominal speed. */
const NOMINAL_SPEED_MPS = START_REMAINING_M / (12 * 60);
/** Demo compression: 1 real second = 8 simulated seconds, so 12 minutes plays in ~90 s. */
const TIME_SCALE = 8;
/** GPS fix cadence, like a rider app's location heartbeat. */
export const FIX_INTERVAL_MS = 1000;
const ARRIVAL_THRESHOLD_M = 4;

/**
 * Simulates the assigned Pro's GPS heartbeat for the active order.
 *
 * Fixes arrive every second with realistic speed jitter, braking into
 * corners and the occasional stop (traffic light / junction). Renderers never
 * jump to a fix: they call `displayDistance(now)` every animation frame, which
 * interpolates along the street from the previous fix to the latest — the
 * dead-reckoning technique delivery apps use so the rider glides smoothly.
 */
@Injectable({ providedIn: 'root' })
export class TrackingSimService implements OnDestroy {
  private readonly orders = inject(OrderService);
  private readonly zone = inject(NgZone);

  readonly route = new RouteTrack(TUGUEGARAO_ROUTE, 'geo');
  readonly startDistance = Math.max(0, this.route.total - START_REMAINING_M);
  readonly destination = TUGUEGARAO_ROUTE[TUGUEGARAO_ROUTE.length - 1];
  readonly origin = TUGUEGARAO_ROUTE[0];

  private prev: Fix = { distance: this.startDistance, at: 0 };
  private readonly latest = signal<Fix>({ distance: this.startDistance, at: 0 });
  private timer: ReturnType<typeof setInterval> | null = null;
  private stoppedTicks = 0;

  readonly remainingM = computed(() => Math.max(0, this.route.total - this.latest().distance));
  readonly etaMinutes = computed(() => Math.max(1, Math.ceil(this.remainingM() / NOMINAL_SPEED_MPS / 60)));
  readonly arrived = computed(() => this.remainingM() <= ARRIVAL_THRESHOLD_M);
  /** 0..1 progress of the trip leg shown to the customer. */
  readonly legProgress = computed(() => 1 - this.remainingM() / START_REMAINING_M);
  readonly running = signal(false);

  readonly etaLabel = computed(() => {
    if (this.arrived()) return 'Your helper has arrived';
    return `Arriving in ${this.etaMinutes()} min${this.etaMinutes() === 1 ? '' : 's'} (${formatDistance(this.remainingM())})`;
  });

  constructor() {
    // Drive the simulation from the order lifecycle.
    effect(() => {
      const status = this.orders.order().status;
      untracked(() => {
        if (status === 'EN_ROUTE') this.start();
        else if (status === 'ACCEPTED' || status === 'PENDING_ACCEPTANCE') this.park(this.startDistance);
        else this.park(this.route.total);
      });
    });
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  /** Interpolated distance for the current animation frame. */
  displayDistance(now = performance.now()): number {
    const cur = this.latest();
    if (!this.running()) return cur.distance;
    const t = Math.min(1, Math.max(0, (now - cur.at) / FIX_INTERVAL_MS));
    return this.prev.distance + (cur.distance - this.prev.distance) * t;
  }

  sample(distance: number): RouteSample & { smoothBearing: number } {
    const s = this.route.sample(distance);
    return { ...s, smoothBearing: this.route.smoothedBearing(distance, 30) };
  }

  /** Demo control: send the rider back to the start of the leg. */
  replay(): void {
    this.orders.setStatus('EN_ROUTE');
    this.park(this.startDistance);
    this.start();
  }

  private start(): void {
    if (this.timer) return;
    const now = performance.now();
    const d = this.latest().distance >= this.route.total - ARRIVAL_THRESHOLD_M ? this.startDistance : this.latest().distance;
    this.prev = { distance: d, at: now };
    this.latest.set({ distance: d, at: now });
    this.running.set(true);
    // Timer runs outside Angular; signals notify consumers without global change detection churn.
    this.zone.runOutsideAngular(() => {
      this.timer = setInterval(() => this.tick(), FIX_INTERVAL_MS);
    });
  }

  private park(distance: number): void {
    this.stopTimer();
    this.running.set(false);
    const now = performance.now();
    this.prev = { distance, at: now };
    this.latest.set({ distance, at: now });
  }

  private tick(): void {
    const cur = this.latest();
    let step = 0;

    if (this.stoppedTicks > 0) {
      this.stoppedTicks--;
    } else if (Math.random() < 0.05 && this.remainingM() > 150) {
      this.stoppedTicks = 1 + Math.floor(Math.random() * 3); // junction / traffic light
    } else {
      const jitter = 0.75 + Math.random() * 0.5;
      const corner = this.route.cornerFactor(cur.distance, 35, 0.4);
      step = NOMINAL_SPEED_MPS * TIME_SCALE * (FIX_INTERVAL_MS / 1000) * jitter * corner;
    }

    const next = Math.min(this.route.total, cur.distance + step);
    this.prev = { distance: this.displayDistance(), at: performance.now() };
    this.latest.set({ distance: next, at: performance.now() });

    if (this.route.total - next <= ARRIVAL_THRESHOLD_M) {
      this.stopTimer();
      // Let the final glide finish before the order flips to ARRIVED.
      setTimeout(() => this.zone.run(() => this.orders.setStatus('ARRIVED')), FIX_INTERVAL_MS);
    }
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

export function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.max(10, Math.round(m / 10) * 10)} m`;
}
