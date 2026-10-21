// reverse geocoding
import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';

export interface AddressFields { street: string; barangay: string; city: string }

@Injectable({ providedIn: 'root' })
export class ReverseGeocodingService {
  private readonly api = inject(ApiService);
  async lookup(lat: number, lng: number): Promise<AddressFields> {
    try { return await this.api.get<AddressFields>('/locations/reverse', { lat, lng }); }
    catch(error) {
      if (!(error instanceof HttpErrorResponse) || error.status !== 429) throw error;
      await new Promise(resolve => setTimeout(resolve, 1200));
      return this.api.get<AddressFields>('/locations/reverse', { lat, lng });
    }
  }
}
