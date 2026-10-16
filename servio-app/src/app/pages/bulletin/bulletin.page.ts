import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonHeader, IonIcon, IonModal, IonToolbar } from '@ionic/angular';
import * as L from 'leaflet';
import { servioTileLayer } from '../../shared/utils/map-tiles';
import { TUGUEGARAO_CENTER } from '../../core/data/launch-city';
import { CATEGORIES } from '../../core/data/mock-data';
import { CommunityService } from '../../core/services/community.service';
import { SheetsService } from '../../core/services/sheets.service';
import { SearchFilterComponent } from '../../shared/components/search-filter/search-filter.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { PhpPipe } from '../../shared/pipes/php.pipe';

type Filter = 'ALL' | 'OPEN' | 'URGENT' | 'NEARBY';

/** Illustrative pins around Centro 10, Ugac Norte, Centro 5, Tanza, Caritan Centro and Atulayan Sur. */
const PIN_COORDS: [number, number][] = [
  [17.6134, 121.7305], [17.618111, 121.718927], [17.608459, 121.726858], [17.626467, 121.735061], [17.625031, 121.721542], [17.634940, 121.720236],
];

@Component({
  selector: 'app-bulletin',
  templateUrl: 'bulletin.page.html',
  styleUrl: 'bulletin.page.scss',
  imports: [DecimalPipe, IonHeader, IonToolbar, IonContent, IonIcon, IonModal, SearchFilterComponent, StatusBadgeComponent, PhpPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BulletinPage {
  private readonly sheets = inject(SheetsService);
  private readonly router = inject(Router);
  @ViewChild('pinMap') pinMapEl?: ElementRef<HTMLDivElement>;
  private pinMap?: L.Map;

  readonly isFinite = Number.isFinite;
  readonly community = inject(CommunityService);
  ionViewWillEnter(): void { void this.community.refresh(); }
  readonly filters: { id: Filter; label: string }[] = [
    { id: 'ALL', label: 'All' },
    { id: 'OPEN', label: 'Open' },
    { id: 'URGENT', label: 'Urgent' },
    { id: 'NEARBY', label: 'Nearby (< 3km)' },
  ];
  readonly filter = signal<Filter>('ALL');
  readonly query = signal('');
  readonly categoryById = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

  readonly requests = computed(() => {
    const f = this.filter();
    const q = this.query().toLowerCase();
    return this.community.requests().filter((r) => {
      if (f === 'OPEN' && r.status !== 'OPEN') return false;
      if (f === 'URGENT' && r.status !== 'URGENT') return false;
      if (f === 'NEARBY' && r.distanceKm >= 3) return false;
      return !q || `${r.title} ${r.description} ${r.neighborhood}`.toLowerCase().includes(q);
    });
  });

  readonly openCount = computed(() => this.community.requests().filter((r) => (r.status === 'OPEN' || r.status === 'URGENT') && r.distanceKm <= 5).length);

  constructor() {
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((p) => {
        if (p.get('compose')) {
          this.compose();
          this.router.navigate([], { queryParams: { compose: null }, queryParamsHandling: 'merge', replaceUrl: true });
        }
      });
  }

  compose(): void {
    this.sheets.openPostBulletin();
  }

  initPinMap(): void {
    if (!this.pinMapEl) return;
    this.pinMap?.remove();
    const map = L.map(this.pinMapEl.nativeElement, { zoomControl: false }).setView([...TUGUEGARAO_CENTER], 14);
    servioTileLayer().addTo(map);
    this.requests().forEach((r, i) => {
      if (!this.community.api.settings.useMockApi() && (r.lat == null || r.lng == null)) return;
      const urgent = r.status === 'URGENT';
      L.marker(r.lat != null && r.lng != null ? [r.lat, r.lng] : PIN_COORDS[i % PIN_COORDS.length], {
        icon: L.divIcon({
          className: 'bulletin-pin',
          iconSize: [30, 38],
          iconAnchor: [15, 36],
          html: `<span class="pin ${urgent ? 'urgent' : ''}"></span>`,
        }),
        title: r.title,
      })
        .bindTooltip(r.title, { direction: 'top', offset: [0, -34] })
        .addTo(map);
    });
    this.pinMap = map;
    setTimeout(() => map.invalidateSize(), 50);
  }

  destroyPinMap(): void {
    this.pinMap?.remove();
    this.pinMap = undefined;
  }
}
