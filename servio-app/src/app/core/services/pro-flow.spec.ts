import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ApiService } from '../api/api.service';
import { AuthService } from './auth.service';
import { WalletService } from './wallet.service';
import { OrderService } from './order.service';

const original = {
  id: '00000000-0000-4000-8000-000000000002', code: 'SRV-8822', customerId: 'customer', proId: 'pro', skuId: 'sku-ac-leak', skuName: 'AC repair', priceCentavos: 110000,
  trustFeeCentavos: 5000, address: { street: 'Ugac Norte', barangay: 'Ugac Norte', city: 'Tuguegarao City' }, lat: 17.618111, lng: 121.718927,
  schedule: 'ASAP', paymentMethod: 'GCASH', status: 'IN_PROGRESS', escrow: 'HOLD_AUTHORIZED', tipCentavos: 0, expectedArrivalAt: null, events: [], addons: [],
  customer: { id: 'customer', name: 'Sophia M.', avatarKey: null }, pro: { id: 'pro', name: 'Daniel K.', avatarKey: null, rating: 4.9, ratingCount: 28 }, reviewed: false,
};

describe('server-owned Pro actions', () => {
  const settings = { ready: Promise.resolve(), useMockApi: signal(false) };
  const api = { settings, get: vi.fn(), post: vi.fn(), upload: vi.fn(), imageUrl: vi.fn() };
  const user = signal<{ id: string; role: string } | null>(null);
  const wallet = { refresh: vi.fn(), credit: vi.fn() };
  let storage: Map<string,string>;
  beforeEach(() => {
    vi.clearAllMocks(); user.set(null); settings.useMockApi.set(false); storage = new Map();
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key,value), removeItem: (key: string) => storage.delete(key) });
    api.get.mockImplementation(async (path: string) => path === '/catalog' ? { trustFeeCentavos: 5000, skus: [], addons: [], cancellationFees: { enRouteCentavos: 10000, arrivedCentavos: 20000 } } : { booking: structuredClone(original) });
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }, { provide: AuthService, useValue: { user, refreshProfile: vi.fn().mockResolvedValue(undefined) } }, { provide: WalletService, useValue: wallet }] });
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.unstubAllGlobals(); });

  it('waits for server status/PIN success and refreshes the wallet without local credits', async () => {
    const orders = TestBed.inject(OrderService); TestBed.tick(); await orders.load(original.id);
    api.post.mockRejectedValueOnce(new Error('PIN locked'));
    await expect(orders.complete('0000')).rejects.toThrow('PIN locked');
    expect(orders.order().escrow).toBe('HOLD_AUTHORIZED'); expect(wallet.credit).not.toHaveBeenCalled();
    api.post.mockResolvedValueOnce({});
    api.get.mockImplementation(async (path: string) => path === '/catalog' ? { trustFeeCentavos: 5000, skus: [], addons: [] } : { booking: { ...original, status: 'COMPLETED', escrow: 'COMPLETED' } });
    expect(await orders.complete('2468')).toBe(true);
    expect(api.post).toHaveBeenLastCalledWith(`/bookings/${original.id}/verify-pin`, { pin: '2468' });
    expect(wallet.refresh).toHaveBeenCalled(); expect(wallet.credit).not.toHaveBeenCalled();
    expect(orders.order().completionPin).toBe('');
  });

  it('never writes a live PIN/snapshot into the offline store when switching modes', async () => {
    const orders = TestBed.inject(OrderService); TestBed.tick();
    api.get.mockImplementation(async (path: string) => path === '/catalog' ? { trustFeeCentavos: 5000, skus: [], addons: [] } : { booking: { ...original, completionPin: '8563' } });
    await orders.load(original.id); TestBed.tick();
    expect(storage.has('servio.demo.order')).toBe(false);
    settings.useMockApi.set(true); TestBed.tick();
    expect(storage.get('servio.demo.order')).not.toContain('8563');
    expect(orders.order().id).toBe('SRV-8821'); expect(orders.order().completionPin).toBe('7492');
  });
});

describe('live wallet', () => {
  const api = { settings: { ready: Promise.resolve(), useMockApi: signal(false) }, get: vi.fn(), post: vi.fn() };
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }, { provide: AuthService, useValue: { user: signal({ id: 'pro', role: 'PRO' }) } }] });
  });
  afterEach(() => TestBed.resetTestingModule());
  it('maps ledger centavos, preserves a rejected cashout, and submits the PH destination and fee-aware amount', async () => {
    const snapshot = { availableCentavos: 123250, pendingEscrowCentavos: 0, todayNetCentavos: 123250,
      ledger: [{ id: 'entry', amountCentavos: 123250, kind: 'ESCROW_RELEASE', title: 'AC repair', bookingCode: 'SRV-8822', memo: null, createdAt: new Date().toISOString() }], nextCursor: null };
    api.get.mockResolvedValue(snapshot);
    const wallet = TestBed.inject(WalletService); TestBed.tick(); await wallet.refresh();
    expect(wallet.availablePhp()).toBe(1232.5); expect(wallet.ledger()[0].kind).toBe('credit');
    expect(() => wallet.credit(100, 'fake', 'fake')).toThrow();
    api.post.mockRejectedValueOnce(new Error('Insufficient balance'));
    expect(await wallet.cashout(500, '9171234567')).toBe('Insufficient balance'); expect(wallet.availablePhp()).toBe(1232.5);
    api.post.mockResolvedValueOnce({}); api.get.mockResolvedValueOnce({ ...snapshot, availableCentavos: 71750 });
    expect(await wallet.cashout(500, '9171234567')).toBeNull();
    expect(api.post).toHaveBeenLastCalledWith('/wallet/cashout', { amountCentavos: 50000, gcashNumber: '09171234567' }); expect(wallet.availablePhp()).toBe(717.5);
  });
});
