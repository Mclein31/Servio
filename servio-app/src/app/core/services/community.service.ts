import { computed, inject, Injectable, signal } from '@angular/core';
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
  private readonly liveHelpers = signal<HelperProfile[]>([]);
  private readonly liveSkus = signal<ServiceSku[]>([]);
  private readonly liveAddons = signal<AddonSku[]>([]);
  private readonly liveRequests = signal<BulletinRequest[]>([]);
  private readonly fee = signal(50);
  readonly cancellationFees = signal<CatalogDto['cancellationFees'] | null>(null);
  readonly helpers = computed(() => this.api.settings.useMockApi() ? HELPERS : this.liveHelpers());
  readonly skus = computed(() => this.api.settings.useMockApi() ? BULLETIN_SKUS : this.liveSkus());
  readonly addons = computed(() => this.api.settings.useMockApi() ? ADDON_CATALOG : this.liveAddons());
  readonly requests = computed(() => this.api.settings.useMockApi() ? BULLETIN_REQUESTS : this.liveRequests());
  readonly trustFeePhp = computed(() => this.api.settings.useMockApi() ? 50 : this.fee());
  readonly loading = signal(false);
  readonly error = signal('');
  private catalogLoading?: Promise<void>;

  async catalog(): Promise<void> {
    await this.api.settings.ready;
    if (this.api.settings.useMockApi()) return;
    if (!this.catalogLoading) this.catalogLoading = this.api.get<CatalogDto>('/catalog').then((r) => {
      this.liveSkus.set(r.skus.map(skuFromApi)); this.liveAddons.set(r.addons.map(addonFromApi)); this.fee.set(r.trustFeeCentavos / 100); this.cancellationFees.set(r.cancellationFees);
    }).finally(() => { this.catalogLoading = undefined; });
    await this.catalogLoading;
  }
  async image(key: string | null): Promise<string> { return key ? this.api.imageUrl(key) : ''; }
  async directory(): Promise<void> {
    await this.api.settings.ready;
    if (this.api.settings.useMockApi()) return;
    const { pros } = await this.api.get<{ pros: ProDto[] }>('/pros');
    this.liveHelpers.set(await Promise.all(pros.map(async (p): Promise<HelperProfile> => ({
      id: p.id, name: p.name, avatarUrl: await this.image(p.avatarKey), category: p.headline ?? p.skus[0]?.categoryId ?? '',
      rating: p.rating, reviewCount: p.ratingCount, distanceKm: Math.round((p.distanceKm ?? 0) * 10) / 10,
      hourlyRatePhp: p.fromPriceCentavos / 100, rateUnit: p.skus.find((s) => s.priceCentavos === p.fromPriceCentavos)?.unit, isAvailable: p.isOnline, bio: p.bio ?? '', credentials: p.credentials,
      skus: p.skus.map(skuFromApi), reviews: p.reviews.map((r) => ({ author: r.author ?? 'Neighbor', rating: r.rating, when: postedAgo(r.createdAt), text: r.body ?? '' })),
      jobsDone: p.jobsDone, yearsExperience: p.yearsExperience,
    }))));
  }
  async bulletin(): Promise<void> {
    await this.api.settings.ready;
    if (this.api.settings.useMockApi()) return;
    const { requests } = await this.api.get<{ requests: BulletinDto[] }>('/bulletin');
    this.liveRequests.set(requests.map((r) => ({ id: r.id, title: r.title, description: r.description, category: r.categoryId, author: r.author,
      postedAgo: postedAgo(r.createdAt), neighborhood: r.neighborhood, distanceKm: r.distanceKm ?? Infinity, pricePhp: r.priceCentavos / 100,
      priceUnit: r.unit === 'visit' ? 'job' : r.unit, status: r.status, lat: r.lat ?? undefined, lng: r.lng ?? undefined })));
  }
  async refresh(): Promise<void> {
    this.loading.set(true); this.error.set('');
    try { await Promise.all([this.catalog(), this.directory(), this.bulletin()]); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Could not load nearby services.'); }
    finally { this.loading.set(false); }
  }
  async postRequest(input: { skuId: string; categoryId: string; description: string; neighborhood: string; urgent: boolean }): Promise<void> {
    if (this.api.settings.useMockApi()) return;
    await this.api.post('/bulletin', input); await this.bulletin();
  }
}
