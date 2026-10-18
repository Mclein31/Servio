import { computed, inject, Injectable } from '@angular/core';
import { AddressService } from './address.service';

@Injectable({ providedIn: 'root' })
export class DiscoveryLocationService {
  private readonly addresses = inject(AddressService);
  readonly point = computed(() => {
    const address = this.addresses.selected();
    return address && Number.isFinite(address.lat) && Number.isFinite(address.lng)
      && Math.abs(address.lat) <= 90 && Math.abs(address.lng) <= 180
      ? { lat: address.lat, lng: address.lng } : null;
  });
  query(): Record<string, number> {
    const point = this.point();
    return point ? { lat: point.lat, lng: point.lng } : {};
  }
  async refresh(): Promise<void> { await this.addresses.refresh(); }
}
