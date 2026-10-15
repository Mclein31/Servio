import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { IonIcon } from '@ionic/angular';
import * as L from 'leaflet';
import { servioTileLayer } from '../../utils/map-tiles';
import { OrderService } from '../../../core/services/order.service';
import { TrackingSimService } from '../../../core/services/tracking-sim.service';
import { lerpAngle, prefersReducedMotion } from '../../utils/motion';
import { Point } from '../../utils/route-track';

const FOLLOW_INTERVAL_MS = 2500;

/**
 * Live rider map in the style of delivery apps:
 *  - rider glides along the street geometry every frame (dead-reckoning between GPS fixes)
 *  - a heading cone rotates smoothly toward the direction of travel
 *  - travelled path turns neutral gray, the remaining path stays brand orange
 *  - the camera keeps rider + destination framed until the user pans, then offers "Re-center"
 */
@Component({
  selector: 'app-tracking-map',
  imports: [IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="frame" [style.height.px]="height">
      <div #mapEl class="map" role="application" aria-label="Live map of your helper's route"></div>
      @if (showEtaChip) {
        <div class="eta-chip" [class.arrived]="sim.arrived()" aria-live="polite">
          <span class="pulse" aria-hidden="true"></span>
          {{ sim.etaLabel() }}
        </div>
      }
      @if (!following()) {
        <button type="button" class="recenter" (click)="recenter()" aria-label="Re-center map on helper">
          <ion-icon name="locate-outline" aria-hidden="true"></ion-icon>
        </button>
      }
    </div>
  `,
  styleUrl: './tracking-map.component.scss',
})
export class TrackingMapComponent implements AfterViewInit, OnDestroy {
  @Input() height = 280;
  @Input() showEtaChip = true;
  @Input() interactive = true;

  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  readonly sim = inject(TrackingSimService);
  private readonly orders = inject(OrderService);
  private readonly zone = inject(NgZone);

  readonly following = signal(true);

  private map?: L.Map;
  private travelled?: L.Polyline;
  private remainingCasing?: L.Polyline;
  private remaining?: L.Polyline;
  private rider?: L.Marker;
  private headingEl: HTMLElement | null = null;
  private frame = 0;
  private visible = true;
  private observer?: IntersectionObserver;
  private lastFollow = 0;
  private bearing = 0;
  private reducedMotion = prefersReducedMotion();

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => this.init());
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
    this.map?.remove();
  }

  /** Call from ionViewDidEnter: Ionic caches tab pages, so the container may have been 0×0 when Leaflet measured it. */
  refresh(): void {
    if (!this.map) return;
    this.map.invalidateSize({ pan: false });
    this.reducedMotion = prefersReducedMotion();
    this.frameCamera(false);
  }

  recenter(): void {
    this.following.set(true);
    this.frameCamera(true);
  }

  private init(): void {
    const route = this.sim.route;
    const startDist = this.sim.displayDistance();
    const [done, left] = route.split(startDist);
    const start = route.sample(startDist);
    this.bearing = route.smoothedBearing(startDist, 30);

    const map = L.map(this.mapEl.nativeElement, {
      zoomControl: false,
      attributionControl: true,
      dragging: this.interactive,
      touchZoom: this.interactive,
      scrollWheelZoom: false,
      doubleClickZoom: this.interactive,
      boxZoom: false,
      keyboard: this.interactive,
      zoomSnap: 0.25,
      fadeAnimation: true,
      markerZoomAnimation: true,
    });
    this.map = map;

    servioTileLayer().addTo(map);

    this.travelled = L.polyline(toLatLngs(done), { color: '#9CA3AF', weight: 4, opacity: 0.9, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(map);
    this.remainingCasing = L.polyline(toLatLngs(left), { color: '#FFFFFF', weight: 9, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(map);
    this.remaining = L.polyline(toLatLngs(left), { color: '#FF5C00', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(map);

    L.marker(toLatLng(this.sim.origin), { icon: originIcon(), interactive: false, keyboard: false }).addTo(map);
    L.marker(toLatLng(this.sim.destination), { icon: destinationIcon(), interactive: false, keyboard: false, zIndexOffset: 500 }).addTo(map);

    const helper = this.orders.order().helper;
    this.rider = L.marker(toLatLng(start.point), {
      icon: riderIcon(helper.avatarUrl, helper.name),
      interactive: false,
      keyboard: false,
      zIndexOffset: 1000,
    }).addTo(map);
    this.headingEl = this.rider.getElement()?.querySelector('.rider-heading') ?? null;
    this.applyHeading();

    map.on('dragstart zoomstart', (e: L.LeafletEvent) => {
      // Programmatic camera moves fire zoomstart too; only user gestures carry an originalEvent.
      if ((e as L.LeafletMouseEvent).originalEvent || e.type === 'dragstart') this.zone.run(() => this.following.set(false));
    });

    this.frameCamera(false);

    this.observer = new IntersectionObserver(([entry]) => {
      const wasVisible = this.visible;
      this.visible = entry.isIntersecting;
      if (this.visible && !wasVisible) {
        this.refresh();
        this.loop();
      }
    });
    this.observer.observe(this.mapEl.nativeElement);
    this.loop();
  }

  private loop = (): void => {
    cancelAnimationFrame(this.frame);
    if (!this.visible || !this.map) return;
    this.render(performance.now());
    this.frame = requestAnimationFrame(this.loop);
  };

  private render(now: number): void {
    const route = this.sim.route;
    const d = this.reducedMotion ? route.total - this.sim.remainingM() : this.sim.displayDistance(now);
    const sample = route.sample(d);
    const [done, left] = route.split(d);

    this.rider!.setLatLng(toLatLng(sample.point));
    this.travelled!.setLatLngs(toLatLngs(done));
    this.remainingCasing!.setLatLngs(toLatLngs(left));
    this.remaining!.setLatLngs(toLatLngs(left));

    const target = route.smoothedBearing(d, 30);
    this.bearing = this.reducedMotion ? target : lerpAngle(this.bearing, target, 0.12);
    this.applyHeading();
    this.rider!.getElement()?.classList.toggle('arrived', this.sim.arrived());

    if (this.following() && now - this.lastFollow > FOLLOW_INTERVAL_MS) {
      this.lastFollow = now;
      this.frameCamera(!this.reducedMotion);
    }
  }

  private applyHeading(): void {
    if (this.headingEl) this.headingEl.style.transform = `rotate(${this.bearing}deg)`;
  }

  /** Keep rider and destination in view, leaving room for the ETA chip. */
  private frameCamera(animate: boolean): void {
    if (!this.map || !this.rider) return;
    const bounds = L.latLngBounds([this.rider.getLatLng(), toLatLng(this.sim.destination)]);
    this.map.fitBounds(bounds, {
      paddingTopLeft: [40, this.showEtaChip ? 104 : 56],
      paddingBottomRight: [40, 40],
      maxZoom: 17.5,
      animate,
      duration: 1.1,
      easeLinearity: 0.3,
    });
  }
}

function toLatLng(p: Point): L.LatLngExpression {
  return [p[0], p[1]];
}

function toLatLngs(points: Point[]): L.LatLngExpression[] {
  return points.map(toLatLng);
}

function escapeAttr(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function riderIcon(avatarUrl: string, name: string): L.DivIcon {
  const face = avatarUrl
    ? `<img class="rider-face" src="${escapeAttr(avatarUrl)}" alt="" />`
    : `<span class="rider-face rider-initials">${escapeAttr(name.slice(0, 1))}</span>`;
  return L.divIcon({
    className: 'servio-rider',
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    html: `<span class="accuracy-halo"></span><span class="rider-heading"><span class="rider-cone"></span></span>${face}`,
  });
}

function destinationIcon(): L.DivIcon {
  return L.divIcon({
    className: 'servio-destination',
    iconSize: [40, 48],
    iconAnchor: [20, 46],
    html: `<span class="dest-pin"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 3 10.5V21h6v-6h6v6h6V10.5z" fill="#fff"/></svg></span><span class="dest-label">You</span>`,
  });
}

function originIcon(): L.DivIcon {
  return L.divIcon({ className: 'servio-origin', iconSize: [14, 14], iconAnchor: [7, 7], html: '<span></span>' });
}
