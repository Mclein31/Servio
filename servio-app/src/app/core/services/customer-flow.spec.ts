import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ApiService } from '../api/api.service';
import { BookingDto, CatalogDto } from '../api/customer.models';
import { AuthService } from './auth.service';
import { CommunityService } from './community.service';
import { OrderService } from './order.service';
import { WalletService } from './wallet.service';
import { scheduleWindow } from '../../pages/checkout/checkout.page';

const catalog: CatalogDto = { trustFeeCentavos: 5000, cancellationFees: { enRouteCentavos: 10000, arrivedCentavos: 20000 },
  skus: [{ id: 'sku-ac-leak', categoryId: 'repairs', name: 'Split AC Water Leak Repair', priceCentavos: 110000, unit: 'job', durationLabel: '45–60 min', inclusions: ['Diagnosis'] }],
  addons: [{ id: 'addon-drain-hose', name: 'Drain hose', detail: '3 meters', priceCentavos: 35000 }],
};
const booking: BookingDto = {
  id: '00000000-0000-4000-8000-000000000001', code: 'SRV-8821', customerId: 'customer', proId: 'pro', skuId: 'sku-ac-leak', skuName: 'Booked snapshot',
  priceCentavos: 110000, trustFeeCentavos: 5000, address: { street: 'Ugac Norte', barangay: 'Ugac Norte', city: 'Tuguegarao City' }, lat: 17.618111, lng: 121.718927,
  schedule: 'ASAP', paymentMethod: 'GCASH', status: 'IN_PROGRESS', escrow: 'HOLD_AUTHORIZED', completionPin: '2468', tipCentavos: 0,
  expectedArrivalAt: null, events: [{ status: 'IN_PROGRESS', createdAt: '2026-10-16T00:00:00Z', note: null }], reviewed: false,
  customer: { id: 'customer', name: 'Sophia M.', avatarKey: null }, pro: { id: 'pro', name: 'Daniel K.', avatarKey: null, rating: 4.9, ratingCount: 28 },
  addons: [{ id: 'quote', addonSkuId: 'addon-drain-hose', addonName: 'Drain hose', priceCentavos: 35000, photoKey: 'test-photo', note: 'Cracked hose', createdAt: '2026-10-16T00:01:00Z', decision: 'PENDING' }],
};

describe('live customer data and escrow screens', () => {
  const api = { settings: { ready: Promise.resolve(), useMockApi: signal(false) }, get: vi.fn(), post: vi.fn(), imageUrl: vi.fn() };
  beforeEach(() => {
    api.get.mockReset(); api.post.mockReset(); api.imageUrl.mockResolvedValue('https://storage.example/evidence');
    api.get.mockImplementation(async (path: string) => path === '/catalog' ? catalog : { booking: structuredClone(booking) });
    TestBed.configureTestingModule({ providers: [
      { provide: ApiService, useValue: api }, { provide: AuthService, useValue: { user: signal(null) } }, { provide: WalletService, useValue: { refresh: vi.fn().mockResolvedValue(undefined) } },
    ] });
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); });

  it('starts empty in live mode, maps centavos/snapshots, and updates escrow only after server approval', async () => {
    const orders = TestBed.inject(OrderService); TestBed.tick();
    expect(orders.hasOrder()).toBe(false); expect(orders.order().completionPin).toBe('');
    await orders.load(booking.id);
    expect(orders.order().code).toBe('SRV-8821'); expect(orders.order().sku.name).toBe('Booked snapshot');
    expect(orders.escrowTotalPhp()).toBe(1150); expect(orders.pendingAddon()?.photoUrl).toContain('storage.example');
    api.post.mockRejectedValueOnce(new Error('Hold failed'));
    await expect(orders.decideAddon('quote', true)).rejects.toThrow('Hold failed');
    expect(orders.escrowTotalPhp()).toBe(1150);
    api.post.mockResolvedValueOnce({});
    api.get.mockImplementation(async (path: string) => path === '/catalog' ? catalog : { booking: { ...booking, addons: [{ ...booking.addons[0], decision: 'APPROVED' }] } });
    await orders.decideAddon('quote', true);
    expect(orders.escrowTotalPhp()).toBe(1500); expect(orders.proPayoutPhp()).toBe(1232.5);
    expect(orders.order().statusTimes.IN_PROGRESS).toBeInstanceOf(Date);
    expect(() => orders.setStatus('COMPLETED')).toThrow(); expect(orders.verifyCompletionPin('2468')).toBe(false);
  });

  it('sends catalog IDs and a stable retry key without client prices or simulated status changes', async () => {
    const orders = TestBed.inject(OrderService); TestBed.tick();
    await TestBed.inject(CommunityService).catalog();
    api.post.mockResolvedValue({ booking });
    const sku = TestBed.inject(CommunityService).skus()[0];
    await orders.book('GCASH', 'Immediate / ASAP', sku, undefined, 'stable-retry', undefined, {id:'address',label:'Home',...booking.address,landmark:null,lat:17.61,lng:121.72,isDefault:true});
    await orders.book('GCASH', 'Immediate / ASAP', sku, undefined, 'stable-retry', undefined, {id:'address',label:'Home',...booking.address,landmark:null,lat:17.61,lng:121.72,isDefault:true});
    expect(api.post).toHaveBeenLastCalledWith('/bookings', expect.objectContaining({ skuId: 'sku-ac-leak', schedule: 'ASAP', paymentMethod: 'GCASH',lat:17.61,lng:121.72,address:expect.objectContaining({street:'Ugac Norte'}) }), { 'Idempotency-Key': 'stable-retry' });
    expect(api.post.mock.calls[0][1].address).not.toHaveProperty('landmark');
    expect(api.post.mock.calls[0][1]).not.toHaveProperty('priceCentavos');
    expect(api.post.mock.calls[0][1]).not.toHaveProperty('status');
    expect(orders.order().status).toBe('IN_PROGRESS');
    await orders.review(5, ['Polite'], 'Good work', 100);
    expect(api.post).toHaveBeenLastCalledWith(`/bookings/${booking.id}/review`, { rating: 5, compliments: ['Polite'], body: 'Good work', tipCentavos: 10000 });
  });

  it('resets through the server and discards stale completion timestamps only after a reset marker', async () => {
    const orders=TestBed.inject(OrderService); TestBed.tick();
    expect(orders.canResetDemo()).toBe(false);
    await orders.resetDemo(); expect(api.post).not.toHaveBeenCalled();
    TestBed.inject(AuthService).user.set({ id:'customer',email:'demo.customer@servio.test',role:'CUSTOMER',fullName:'Sophia M.',phoneNumber:null,avatarKey:null,isDemo:true });
    api.post.mockResolvedValue({ booking });
    api.get.mockImplementation(async (path: string) => path === '/catalog' ? catalog : { booking:{ ...booking,status:'EN_ROUTE',addons:[],events:[
      { status:'COMPLETED',createdAt:'2026-10-15T23:00:00Z',note:null },
      { status:'PENDING_ACCEPTANCE',createdAt:'2026-10-16T00:00:00Z',note:'DEMO_RESET: presentation restarted.' },
      { status:'EN_ROUTE',createdAt:'2026-10-16T00:00:01Z',note:null },
    ] } });
    await orders.resetDemo();
    expect(api.post).toHaveBeenCalledWith('/demo/reset-order',{});
    expect(orders.order().status).toBe('EN_ROUTE');
    expect(orders.order().statusTimes.COMPLETED).toBeUndefined();
    expect(orders.order().statusTimes.EN_ROUTE).toBeInstanceOf(Date);
  });

  it('uses Philippine schedule windows even on a laptop in another timezone', () => {
    const instant = new Date('2026-10-16T17:00:00Z'); // October 17, 01:00 in the Philippines.
    expect(scheduleWindow('Immediate / ASAP', instant)).toBeUndefined();
    expect(scheduleWindow('Today (2:00 PM - 4:00 PM)', instant)).toEqual({ scheduleStartAt: '2026-10-17T06:00:00.000Z', scheduleEndAt: '2026-10-17T08:00:00.000Z' });
    expect(scheduleWindow('Tomorrow Morning', instant)).toEqual({ scheduleStartAt: '2026-10-18T01:00:00.000Z', scheduleEndAt: '2026-10-18T04:00:00.000Z' });
  });
});
