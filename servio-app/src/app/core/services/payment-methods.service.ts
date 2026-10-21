// payment methods
import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';
import { PaymentMethod } from '../../shared/models/domain.models';
@Injectable({providedIn:'root'})
export class PaymentMethodsService {
  private readonly api=inject(ApiService);
  readonly preferred=signal<PaymentMethod>('GCASH');
  async refresh():Promise<void> {
    if(this.api.settings.useMockApi()) return;
    const result=await this.api.get<{preferred:PaymentMethod}>('/me/payment-methods');
    this.preferred.set(result.preferred);
  }
  async save(preferred:PaymentMethod):Promise<void> {
    if(this.api.settings.useMockApi()) throw new Error('Connect to SERVIO to save your payment preference.');
    const result=await this.api.post<{preferred:PaymentMethod}>('/me/payment-methods',{preferred});
    this.preferred.set(result.preferred);
  }
}
