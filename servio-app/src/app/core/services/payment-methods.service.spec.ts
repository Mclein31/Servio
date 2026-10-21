// payment methods tests
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ApiService } from '../api/api.service';
import { PaymentMethodsService } from './payment-methods.service';
describe('account payment preference',()=>{
  const get=vi.fn();const post=vi.fn();
  beforeEach(()=>{vi.resetAllMocks();TestBed.configureTestingModule({providers:[{provide:ApiService,useValue:{settings:{useMockApi:()=>false},get,post}}]});});
  afterEach(()=>TestBed.resetTestingModule());
  it('loads the account preference and retains it when a save fails',async()=>{
    get.mockResolvedValue({preferred:'CARD'});const service=TestBed.inject(PaymentMethodsService);await service.refresh();
    expect(service.preferred()).toBe('CARD');post.mockRejectedValue(new Error('Failed'));
    await expect(service.save('GCASH')).rejects.toThrow('Failed');expect(service.preferred()).toBe('CARD');
    post.mockResolvedValue({preferred:'GCASH'});await service.save('GCASH');expect(post).toHaveBeenCalledWith('/me/payment-methods',{preferred:'GCASH'});
    expect(service.preferred()).toBe('GCASH');
  });
});
