// addresses
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { ApiService } from '../api/api.service';
import { AuthService } from './auth.service';
import { DEMO_ADDRESS } from '../data/launch-city';

export interface SavedAddress {
  id: string; label: string; street: string; barangay: string; city: string; landmark: string | null;
  lat: number; lng: number; isDefault: boolean;
}
export type AddressInput = Omit<SavedAddress, 'id'>;

@Injectable({ providedIn: 'root' })
export class AddressService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  readonly addresses = signal<SavedAddress[]>([]);
  readonly selectedId = signal('');
  readonly selected = computed(() => this.addresses().find((a) => a.id === this.selectedId()) ?? this.addresses().find((a) => a.isDefault) ?? null);
  private identity = '';
  private revision = 0;
  constructor() {
    effect(() => this.syncIdentity());
  }
  private syncIdentity(): void {
    const identity = `${this.api.settings.useMockApi()}:${this.auth.user()?.id ?? ''}`;
    if (identity !== this.identity) { this.identity = identity; this.revision++; this.addresses.set([]); this.selectedId.set(''); }
  }
  async refresh(): Promise<void> {
    this.syncIdentity();
    const identity = this.auth.user()?.id;
    const revision = this.revision;
    if (!identity) { this.addresses.set([]); return; }
    if (this.api.settings.useMockApi()) {
      if (!this.addresses().length) this.addresses.set([{ ...DEMO_ADDRESS, id: 'mock-home', label: 'Home', lat: 17.618111, lng: 121.718927, isDefault: true }]);
      return;
    }
    const result = await this.api.get<{ addresses: SavedAddress[] }>('/me/addresses');
    if (this.auth.user()?.id === identity && revision === this.revision) this.addresses.set(result.addresses);
  }
  async save(input: AddressInput, id?: string): Promise<void> {
    this.revision++;
    const identity = this.auth.user()?.id;
    let address: SavedAddress;
    if (this.api.settings.useMockApi()) address = { ...input, id: id ?? crypto.randomUUID() };
    else address = (await (id ? this.api.patch<{ address: SavedAddress }>(`/me/addresses/${id}`, input) : this.api.post<{ address: SavedAddress }>('/me/addresses', input))).address;
    if (identity !== this.auth.user()?.id) return;
    this.revision++;
    this.addresses.update((rows) => [...rows.filter((a) => a.id !== address.id).map((a) => address.isDefault ? { ...a, isDefault: false } : a), address]);
    this.selectedId.set(address.id);
  }
  async makeDefault(id: string): Promise<void> {
    this.revision++;
    const identity = this.auth.user()?.id;
    if (!this.api.settings.useMockApi()) await this.api.patch(`/me/addresses/${id}`, { isDefault: true });
    if (identity !== this.auth.user()?.id) return;
    this.revision++;
    this.addresses.update((rows) => rows.map((a) => ({ ...a, isDefault: a.id === id })));
  }
  async remove(id: string): Promise<void> {
    this.revision++;
    if (!this.api.settings.useMockApi()) { await this.api.request('DELETE', `/me/addresses/${id}`); this.revision++; await this.refresh(); }
    else this.addresses.update((rows) => { const rest = rows.filter((a) => a.id !== id); return rest.some((a) => a.isDefault) ? rest : rest.map((a,i) => ({ ...a, isDefault: i === 0 })); });
  }
}
