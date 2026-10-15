import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonHeader, IonIcon, IonModal, IonToolbar } from '@ionic/angular';
import * as L from 'leaflet';
import { servioTileLayer } from '../../shared/utils/map-tiles';
import { BULLETIN_REQUESTS, CATEGORIES } from '../../core/data/mock-data';
import { SheetsService } from '../../core/services/sheets.service';
import { SearchFilterComponent } from '../../shared/components/search-filter/search-filter.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { PhpPipe } from '../../shared/pipes/php.pipe';

type Filter = 'ALL' | 'OPEN' | 'URGENT' | 'NEARBY';

/** Illustrative pin positions around Bel-Air / Poblacion for the map sheet. */
const PIN_COORDS: [number, number][] = [
  [14.5605, 121.0262], [14.5588, 121.0301], [14.5652, 121.0318], [14.5562, 121.0241], [14.5679, 121.0279], [14.5541, 121.0336],
];

@Component({
  selector: 'app-bulletin',
  templateUrl: 'bulletin.page.html',
  styleUrl: 'bulletin.page.scss',
  imports: [IonHeader, IonToolbar, IonContent, IonIcon, IonModal, SearchFilterComponent, StatusBadgeComponent, PhpPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BulletinPage {
  private readonly sheets = inject(SheetsService);
  private readonly router = inject(Router);
  @ViewChild('pinMap') pinMapEl?: ElementRef<HTMLDivElement>;
  private pinMap?: L.Map;

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
    return BULLETIN_REQUESTS.filter((r) => {
      if (f === 'OPEN' && r.status !== 'OPEN') return false;
      if (f === 'URGENT' && r.status !== 'URGENT') return false;
      if (f === 'NEARBY' && r.distanceKm >= 3) return false;
      return !q || `${r.title} ${r.description} ${r.neighborhood}`.toLowerCase().includes(q);
    });
  });

  readonly openCount = BULLETIN_REQUESTS.filter((r) => r.status === 'OPEN' || r.status === 'URGENT').length;

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
    const map = L.map(this.pinMapEl.nativeElement, { zoomControl: false }).setView([14.5615, 121.0285], 15);
    servioTileLayer().addTo(map);
    BULLETIN_REQUESTS.forEach((r, i) => {
      const urgent = r.status === 'URGENT';
      L.marker(PIN_COORDS[i % PIN_COORDS.length], {
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
