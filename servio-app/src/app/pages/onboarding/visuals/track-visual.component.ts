// onboarding tracking visual
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { easeOutCubic, lerpAngle, prefersReducedMotion } from '../../../shared/utils/motion';
import { Point, RouteTrack } from '../../../shared/utils/route-track';

const ROUTE: Point[] = [[64, 252], [64, 174], [64, 90], [231, 90], [231, 174], [278, 174]];
const TRIP_KM = 1.2;
const TRIP_MIN = 12;
const START_DELAY_MS = 500;
const CRUISE_PX_S = 92;

@Component({
  selector: 'app-track-visual',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 388 308" role="img" [attr.aria-label]="'Map: helper ' + eta()">
      <defs>
        <clipPath id="tv-face"><circle r="15" /></clipPath>
        <filter id="tv-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#111827" flood-opacity="0.25" />
        </filter>
      </defs>

      <rect width="388" height="308" rx="24" fill="#F2EFE9" />
      <!-- city blocks -->
      <g fill="#E6E2DA">
        <rect x="-10" y="-10" width="62" height="88" rx="8" /><rect x="76" y="-10" width="143" height="88" rx="8" />
        <rect x="243" y="-10" width="160" height="88" rx="8" /><rect x="76" y="102" width="143" height="60" rx="8" />
        <rect x="-10" y="102" width="62" height="60" rx="8" /><rect x="243" y="102" width="160" height="60" rx="8" />
        <rect x="76" y="186" width="143" height="130" rx="8" /><rect x="243" y="186" width="160" height="130" rx="8" />
        <rect x="-10" y="186" width="62" height="130" rx="8" />
      </g>
      <rect x="92" y="200" width="70" height="56" rx="10" fill="#D7EBCF" />
      <rect x="300" y="18" width="70" height="48" rx="10" fill="#D7EBCF" />
      <!-- streets -->
      <g stroke="#FFFFFF" stroke-width="16" stroke-linecap="round" fill="none">
        <path d="M-10 90 H398 M-10 174 H398 M64 -10 V318 M231 -10 V318" />
      </g>
      <g fill="#9CA3AF" font-size="8" font-family="Inter, sans-serif" font-weight="600" letter-spacing="0.5">
        <text x="112" y="93">LUNA ST</text>
        <text x="378" y="197" text-anchor="end">BASSIG ST</text>
      </g>

      <!-- route -->
      <polyline #travelled fill="none" stroke="#9CA3AF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
      <polyline #casing fill="none" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" />
      <polyline #remaining fill="none" stroke="#FF5C00" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />

      <!-- destination -->
      <g transform="translate(300 174)">
        <circle r="5" fill="#FF5C00" opacity="0.25"><animate attributeName="r" values="5;14;5" dur="2.4s" repeatCount="indefinite" /></circle>
        <g transform="translate(0 -6)" filter="url(#tv-shadow)">
          <path d="M0 0 C-10 -12 -14 -18 -14 -24 A14 14 0 1 1 14 -24 C14 -18 10 -12 0 0Z" fill="#FF5C00" />
          <path d="M0 -32 l-7 6 v8 h4 v-5 h6 v5 h4 v-8z" fill="#FFFFFF" />
        </g>
      </g>

      <!-- rider -->
      <g #rider>
        <circle r="30" fill="#FF5C00" class="halo" />
        <g #heading><path d="M0 -29 L8 -18 L-8 -18Z" fill="#FF5C00" /></g>
        <circle r="17" fill="#FFFFFF" filter="url(#tv-shadow)" />
        <image href="assets/avatars/daniel.png" x="-15" y="-15" width="30" height="30" clip-path="url(#tv-face)" preserveAspectRatio="xMidYMid slice" />
      </g>

      <!-- ETA bubble follows the rider -->
      <g #bubble>
        <g [attr.transform]="'translate(' + bubbleX() + ' 0)'">
          <rect x="-78" y="-62" width="156" height="26" rx="13" [attr.fill]="arrived() ? '#087F5B' : '#111827'" filter="url(#tv-shadow)" />
          <text y="-45" text-anchor="middle" fill="#FFFFFF" font-size="11" font-weight="700" font-family="Inter, sans-serif">{{ eta() }}</text>
        </g>
      </g>
    </svg>
  `,
  styles: `
    :host { display: block; }
    svg { display: block; width: 100%; height: auto; border-radius: 24px; overflow: hidden; }
    .halo { opacity: 0.16; transform-box: fill-box; transform-origin: center; animation: halo 2.2s ease-out infinite; }
    @keyframes halo { 0% { transform: scale(0.55); opacity: 0.3; } 100% { transform: scale(1.1); opacity: 0; } }
  `,
})
export class TrackVisualComponent implements OnChanges, OnDestroy {
  @Input() play = false;

  @ViewChild('travelled', { static: true }) travelledEl!: ElementRef<SVGPolylineElement>;
  @ViewChild('casing', { static: true }) casingEl!: ElementRef<SVGPolylineElement>;
  @ViewChild('remaining', { static: true }) remainingEl!: ElementRef<SVGPolylineElement>;
  @ViewChild('rider', { static: true }) riderEl!: ElementRef<SVGGElement>;
  @ViewChild('heading', { static: true }) headingEl!: ElementRef<SVGGElement>;
  @ViewChild('bubble', { static: true }) bubbleEl!: ElementRef<SVGGElement>;

  private readonly zone = inject(NgZone);
  private readonly track = new RouteTrack(ROUTE, 'screen');

  readonly eta = signal(`Arriving in ${TRIP_MIN} min · ${TRIP_KM} km`);
  readonly arrived = signal(false);
  readonly bubbleX = signal(0);

  private frame = 0;
  private distance = 0;
  private bearing = 0;
  private last = 0;
  private startAt = 0;

  ngOnChanges(): void {
    if (this.play) this.start();
    else this.stop();
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private start(): void {
    this.stop();
    this.distance = 0;
    this.bearing = this.track.sample(0).bearing;
    this.arrived.set(false);
    this.draw();
    if (prefersReducedMotion()) return;
    this.startAt = performance.now() + START_DELAY_MS;
    this.last = this.startAt;
    this.zone.runOutsideAngular(() => (this.frame = requestAnimationFrame(this.step)));
  }

  private stop(): void {
    cancelAnimationFrame(this.frame);
  }

  private step = (now: number): void => {
    if (now >= this.startAt) {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      const launch = easeOutCubic(Math.min(1, (now - this.startAt) / 1000));
      const corner = this.track.cornerFactor(this.distance, 34, 0.32);
      this.distance = Math.min(this.track.total, this.distance + CRUISE_PX_S * launch * corner * dt);
      this.last = now;
      this.draw();
    } else {
      this.last = now;
    }
    if (this.distance < this.track.total) this.frame = requestAnimationFrame(this.step);
    else this.zone.run(() => this.settle());
  };

  private settle(): void {
    this.arrived.set(true);
    this.eta.set('Arrived · at your address');
  }

  private draw(): void {
    const d = this.distance;
    const { point } = this.track.sample(d);
    const [done, left] = this.track.split(d);
    const toAttr = (pts: Point[]) => pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

    this.travelledEl.nativeElement.setAttribute('points', toAttr(done));
    this.casingEl.nativeElement.setAttribute('points', toAttr(left));
    this.remainingEl.nativeElement.setAttribute('points', toAttr(left));

    this.bearing = lerpAngle(this.bearing, this.track.smoothedBearing(d, 26), 0.16);
    this.riderEl.nativeElement.setAttribute('transform', `translate(${point[0].toFixed(1)} ${point[1].toFixed(1)})`);
    this.headingEl.nativeElement.setAttribute('transform', `rotate(${this.bearing.toFixed(1)})`);
    this.bubbleEl.nativeElement.setAttribute('transform', `translate(${point[0].toFixed(1)} ${point[1].toFixed(1)})`);

    const shift = Math.max(86 - point[0], Math.min(0, 302 - point[0]));
    if (shift !== this.bubbleX()) this.zone.run(() => this.bubbleX.set(shift));

    const remaining = 1 - d / this.track.total;
    if (remaining > 0.001) {
      const min = Math.max(1, Math.ceil(TRIP_MIN * remaining));
      const m = TRIP_KM * 1000 * remaining;
      const dist = m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.max(10, Math.round(m / 10) * 10)} m`;
      const label = `Arriving in ${min} min · ${dist}`;
      if (label !== this.eta()) this.zone.run(() => this.eta.set(label));
    }
  }
}
