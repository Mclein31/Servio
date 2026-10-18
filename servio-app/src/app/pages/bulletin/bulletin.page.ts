import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ActionSheetController, IonContent, IonFooter, IonHeader, IonIcon, IonModal, IonToolbar } from '@ionic/angular';
import * as L from 'leaflet';
import { servioTileLayer } from '../../shared/utils/map-tiles';
import { TUGUEGARAO_CENTER } from '../../core/data/launch-city';
import { CATEGORIES } from '../../core/data/mock-data';
import { AuthService } from '../../core/services/auth.service';
import { OrderService } from '../../core/services/order.service';
import { BulletinRequest } from '../../shared/models/domain.models';
import { CommunityService } from '../../core/services/community.service';
import { SheetsService } from '../../core/services/sheets.service';
import { SearchFilterComponent } from '../../shared/components/search-filter/search-filter.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { PhpPipe } from '../../shared/pipes/php.pipe';

type Filter = 'MINE' | 'ALL' | 'OPEN' | 'URGENT' | 'NEARBY';

/** Illustrative pins around Centro 10, Ugac Norte, Centro 5, Tanza, Caritan Centro and Atulayan Sur. */
const PIN_COORDS: [number, number][] = [
  [17.6134, 121.7305], [17.618111, 121.718927], [17.608459, 121.726858], [17.626467, 121.735061], [17.625031, 121.721542], [17.634940, 121.720236],
];

@Component({
  selector: 'app-bulletin',
  templateUrl: 'bulletin.page.html',
  styleUrl: 'bulletin.page.scss',
  imports: [DecimalPipe, IonFooter, IonHeader, IonToolbar, IonContent, IonIcon, IonModal, SearchFilterComponent, StatusBadgeComponent, PhpPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BulletinPage {
  private readonly sheets = inject(SheetsService);
  private readonly router = inject(Router);
  private readonly actionSheets = inject(ActionSheetController);
  @ViewChild('requestDetails') requestDetails?: IonModal;
  readonly canDismissRequest = () => !this.saving();
  @ViewChild('pinMap') pinMapEl?: ElementRef<HTMLDivElement>;
  private pinMap?: L.Map;

  readonly isFinite = Number.isFinite;
  readonly community = inject(CommunityService);
  readonly auth = inject(AuthService);
  private readonly orders = inject(OrderService);
  readonly selectedId = signal<string | null>(null);
  readonly selectedRequest = computed(() => this.community.requests().find((r) => r.id === this.selectedId()) ?? null);
  readonly saving = signal(false);
  readonly actionError = signal('');
  private refreshTimer?: ReturnType<typeof setInterval>;
  ionViewWillEnter(): void {
    void this.community.refresh();
    this.stopRefresh();
    this.refreshTimer = setInterval(() => void this.community.bulletin().catch(() => undefined), 10000);
  }
  ionViewDidLeave(): void { this.stopRefresh(); }
  private stopRefresh(): void { clearInterval(this.refreshTimer); this.refreshTimer = undefined; }
  openRequest(request: BulletinRequest, event?: Event): void {
    event?.preventDefault(); this.actionError.set(''); this.selectedId.set(request.id);
  }
  closeRequest(): void { if (!this.saving()) this.selectedId.set(null); }
  isOwner(request: BulletinRequest): boolean { return request.authorId === this.auth.user()?.id; }
  isAcceptedPro(request: BulletinRequest): boolean { return request.acceptedProId === this.auth.user()?.id; }
  async acceptRequest(request: BulletinRequest): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true); this.actionError.set('');
    try {
      await this.community.acceptRequest(request.id);
      // Keep an accepted card visible even when it was opened through the Urgent/Open filter.
      this.filter.set('ALL');
    } catch (error) {
      this.actionError.set(error instanceof Error ? error.message : 'Could not accept this request.');
      await this.community.bulletin().catch(() => undefined);
    } finally { this.saving.set(false); }
  }
  async cancelRequest(request:BulletinRequest):Promise<void>{
    if(this.saving())return;
    this.saving.set(true);this.actionError.set('');
    try{await this.community.cancelRequest(request.id);this.filter.set('MINE');}
    catch(error){this.actionError.set(error instanceof Error?error.message:'Could not cancel request.');}
    finally{this.saving.set(false);}
  }
  async releaseRequest(request: BulletinRequest): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true); this.actionError.set('');
    try { await this.community.releaseRequest(request.id); await this.community.bulletin(); }
    catch (error) { this.actionError.set(error instanceof Error ? error.message : 'Could not release this request.'); }
    finally { this.saving.set(false); }
  }
  async continueRequest(request: BulletinRequest): Promise<void> {
    if (this.saving()) return;
    this.actionError.set('');
    if (request.bookingId) {
      this.saving.set(true);
      try {
        await this.orders.load(request.bookingId);
        this.saving.set(false);
        await this.requestDetails?.dismiss();
        this.selectedId.set(null);
        await this.router.navigate(this.isAcceptedPro(request) ? ['/pro/order', request.bookingId, 'execute'] : ['/tabs/tracking']);
      } catch (error) { this.actionError.set(error instanceof Error ? error.message : 'Could not open booking.'); }
      finally { this.saving.set(false); }
    } else if (this.isOwner(request) && request.acceptedProId && request.skuId) {
      await this.requestDetails?.dismiss();
      this.selectedId.set(null);
      await this.router.navigate(['/checkout'], { queryParams: { bulletin: request.id, helper: request.acceptedProId, sku: request.skuId } });
    }
  }
  readonly filters: { id: Filter; label: string }[] = [
    { id: 'ALL', label: 'All' },
    { id: 'MINE', label: 'My requests' },
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
      if(f==='MINE')return this.isOwner(r);
      if(r.status==='CANCELLED')return false;
      if (r.acceptedProId && !r.bookingId && (this.isOwner(r) || this.isAcceptedPro(r))) return true;
      if (f === 'OPEN' && r.status !== 'OPEN') return false;
      if (f === 'URGENT' && r.status !== 'URGENT') return false;
      if (f === 'NEARBY' && r.distanceKm >= 3) return false;
      return !q || `${r.title} ${r.description} ${r.neighborhood}`.toLowerCase().includes(q);
    });
  });

  readonly openCount = computed(() => this.community.requests().filter((r) => (r.status === 'OPEN' || r.status === 'URGENT') && r.distanceKm <= 5).length);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopRefresh());
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

  async openFilterSheet(): Promise<void> {
    const sheet = await this.actionSheets.create({
      header: 'Filter Requests',
      buttons: [
        ...this.filters.map((f) => ({
          text: f.label,
          role: this.filter() === f.id ? 'selected' : undefined,
          handler: () => {
            this.filter.set(f.id);
          },
        })),
        {
          text: 'Cancel',
          role: 'cancel',
        },
      ],
    });
    await sheet.present();
  }
}
