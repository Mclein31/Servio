import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { DiscoveryLocationService } from './discovery-location.service';
import { ApiService } from '../api/api.service';
import { AddonDto, BulletinDto, CatalogDto, ProDto, SkuDto } from '../api/customer.models';
import { ADDON_CATALOG, BULLETIN_REQUESTS, BULLETIN_SKUS, HELPERS } from '../data/mock-data';
import { AddonSku, BulletinRequest, HelperProfile, ServiceSku } from '../../shared/models/domain.models';

export const skuFromApi = (sku: SkuDto): ServiceSku => ({ id: sku.id, name: sku.name, category: sku.categoryId, pricePhp: sku.priceCentavos / 100, unit: sku.unit, durationLabel: sku.durationLabel, inclusions: sku.inclusions });
export const addonFromApi = (sku: AddonDto): AddonSku => ({ id: sku.id, name: sku.name, detail: sku.detail, pricePhp: sku.priceCentavos / 100 });
export function postedAgo(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000));
  return minutes < 1 ? 'Just now' : minutes < 60 ? `${minutes} mins ago` : minutes < 1440 ? `${Math.floor(minutes / 60)} hours ago` : `${Math.floor(minutes / 1440)} days ago`;
}

@Injectable({ providedIn: 'root' })
export class CommunityService {
  readonly api = inject(ApiService);
  readonly location = inject(DiscoveryLocationService);
  private readonly liveHelpers = signal<HelperProfile[]>([]);
  private readonly liveSkus = signal<ServiceSku[]>([]);
  private readonly liveAddons = signal<AddonSku[]>([]);
  private readonly liveRequests = signal<BulletinRequest[]>([]);
  private readonly fee = signal(50);
  readonly cancellationFees = signal<CatalogDto['cancellationFees'] | null>(null);
  readonly helpers = computed(() => this.api.settings.useMockApi() ? HELPERS : this.liveHelpers().map(h=>this.origin() === this.directoryOrigin() && this.location.point() ? h : {...h,distanceKm:Infinity}));
  readonly skus = computed(() => this.api.settings.useMockApi() ? BULLETIN_SKUS : this.liveSkus());
  readonly addons = computed(() => this.api.settings.useMockApi() ? ADDON_CATALOG : this.liveAddons());
  readonly requests = computed(() => this.api.settings.useMockApi() ? BULLETIN_REQUESTS : this.liveRequests().map(r=>this.origin() === this.bulletinOrigin() && this.location.point() ? r : {...r,distanceKm:Infinity}));
  readonly trustFeePhp = computed(() => this.api.settings.useMockApi() ? 50 : this.fee());
  readonly loading = signal(false);
  readonly error = signal('');
  private readonly directoryOrigin = signal('');
  private readonly bulletinOrigin = signal('');
  private directoryLoaded = false;
  private bulletinLoaded = false;
  private origin(): string { return JSON.stringify(this.location.query()); }
  constructor() {
    let previous = this.origin();
    effect(() => {
      const current = this.origin();
      if (current === previous) return;
      previous = current;
      untracked(() => {
        const updates: Promise<void>[] = [];
        if (this.directoryLoaded) updates.push(this.directory());
        if (this.bulletinLoaded) updates.push(this.bulletin());
        void Promise.all(updates).catch(error => this.error.set(error instanceof Error ? error.message : 'Could not update nearby services.'));
      });
    });
  }
  private bulletinRevision=0;
  private directoryRevision=0;
  private catalogFetchedAt=0;
  private catalogSource='';
  private catalogLoading?: Promise<void>;

  async catalog(): Promise<void> {
    await this.api.settings.ready;
    if (this.api.settings.useMockApi()) return;
    const source=this.api.settings.apiUrl?.() ?? '';
    if(this.catalogSource===source && Date.now()-this.catalogFetchedAt<60000)return;
    if (!this.catalogLoading) this.catalogLoading = this.api.get<CatalogDto>('/catalog').then((r) => {
      this.catalogFetchedAt=Date.now();this.catalogSource=source;
      this.liveSkus.set(r.skus.map(skuFromApi)); this.liveAddons.set(r.addons.map(addonFromApi)); this.fee.set(r.trustFeeCentavos / 100); this.cancellationFees.set(r.cancellationFees);
    }).finally(() => { this.catalogLoading = undefined; });
    await this.catalogLoading;
  }
  async image(key: string | null): Promise<string> { return key ? this.api.imageUrl(key) : ''; }
  async directory(id?: string): Promise<void> {
    await this.api.settings.ready;
    if (this.api.settings.useMockApi()) return;
    this.directoryLoaded=true;
    const revision=++this.directoryRevision;
    const origin=this.origin();
    const { pros } = await this.api.get<{ pros: ProDto[] }>('/pros', {...this.location.query(),...(id ? {id} : {})});
    if(revision!==this.directoryRevision || origin!==this.origin())return;
    const loaded = pros.map((p): HelperProfile => ({
      id: p.id, name: p.name, avatarUrl: this.liveHelpers().find(h=>h.id===p.id)?.avatarUrl ?? '', category: p.headline ?? p.skus[0]?.categoryId ?? '',
      rating: p.rating, reviewCount: p.ratingCount, distanceKm: p.distanceKm == null ? Infinity : Math.round(p.distanceKm * 10) / 10,
      hourlyRatePhp: p.fromPriceCentavos / 100, rateUnit: p.skus.find((s) => s.priceCentavos === p.fromPriceCentavos)?.unit, isAvailable: p.isOnline, bio: p.bio ?? '', credentials: p.credentials,
      skus: p.skus.map(skuFromApi), reviews: p.reviews.map((r) => ({ author: r.author ?? 'Neighbor', rating: r.rating, when: postedAgo(r.createdAt), text: r.body ?? '' })),
      jobsDone: p.jobsDone, yearsExperience: p.yearsExperience,
    }));
    if (this.directoryOrigin() !== origin) this.liveHelpers.update(rows => rows.map(h => ({ ...h, distanceKm: Infinity })));
    this.directoryOrigin.set(origin);this.directoryLoaded=true;
    this.liveHelpers.set(id ? [...this.liveHelpers().filter(h => h.id !== id), ...loaded] : loaded);
    // Cards are usable immediately; signed avatar requests must not block the directory.
    void Promise.all(pros.filter(p=>p.avatarKey).map(async(p)=>{
      const avatarUrl=await this.image(p.avatarKey).catch(()=>'');
      if(revision===this.directoryRevision)this.liveHelpers.update(rows=>rows.map(h=>h.id===p.id?{...h,avatarUrl}:h));
    }));
  }
  async bulletin(): Promise<void> {
    await this.api.settings.ready;
    if (this.api.settings.useMockApi()) return;
    this.bulletinLoaded=true;
    const revision=++this.bulletinRevision;
    const origin=this.origin();
    const { requests } = await this.api.get<{ requests: BulletinDto[] }>('/bulletin',this.location.query());
    if(revision!==this.bulletinRevision || origin!==this.origin())return;
    this.bulletinOrigin.set(origin);this.bulletinLoaded=true;
    this.liveRequests.set(requests.map((r) => ({ id: r.id, authorId: r.authorId, skuId: r.skuId, acceptedProId: r.acceptedProId, bookingId: r.bookingId, title: r.title, description: r.description, category: r.categoryId, author: r.author,
      postedAgo: postedAgo(r.createdAt), neighborhood: r.neighborhood, distanceKm: r.distanceKm ?? Infinity, pricePhp: r.priceCentavos / 100,
      priceUnit: r.unit === 'visit' ? 'job' : r.unit, status: r.status, lat: r.lat ?? undefined, lng: r.lng ?? undefined })));
  }
  async refresh(refreshAddress = true): Promise<void> {
    this.loading.set(true); this.error.set('');
    try {
      if(refreshAddress && !this.api.settings.useMockApi())void this.location.refresh().catch(() => undefined);
      await Promise.all([this.catalog(), this.directory(), this.bulletin()]);
    }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Could not load nearby services.'); }
    finally { this.loading.set(false); }
  }
  async cancelRequest(id:string):Promise<void>{
    if(this.api.settings.useMockApi())throw new Error('Connect to SERVIO to cancel your request.');
    const { request } = await this.api.post<{ request: Pick<BulletinDto, 'id' | 'status' | 'acceptedProId' | 'bookingId'> }>(`/bulletin/${id}/cancel`,{});
    this.bulletinRevision++;
    this.liveRequests.update(rows => rows.map(row => row.id === id
      ? { ...row, status: request.status, acceptedProId: request.acceptedProId, bookingId: request.bookingId }
      : row));
  }
  async acceptRequest(id: string): Promise<void> {
    if (this.api.settings.useMockApi()) throw new Error('Request acceptance requires an API connection.');
    const { request } = await this.api.post<{ request: Pick<BulletinDto, 'id' | 'status' | 'acceptedProId' | 'bookingId'> }>(`/bulletin/${id}/accept`, {});
    this.bulletinRevision++;
    this.liveRequests.update((rows) => rows.map((row) => row.id === id
      ? { ...row, status: request.status, acceptedProId: request.acceptedProId, bookingId: request.bookingId }
      : row));
  }
  async releaseRequest(id: string): Promise<void> {
    if (this.api.settings.useMockApi()) throw new Error('Request acceptance requires an API connection.');
    await this.api.post(`/bulletin/${id}/release`, {});
  }
  async postRequest(input: { skuId: string; categoryId: string; description: string; neighborhood: string; urgent: boolean; lat?:number; lng?:number }): Promise<void> {
    if (this.api.settings.useMockApi()) return;
    await this.api.post('/bulletin', input); await this.bulletin();
  }
}
