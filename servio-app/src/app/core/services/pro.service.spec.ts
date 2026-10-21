// pro tests
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { ApiService } from '../api/api.service';
import { ApiFailure } from '../api/api.interceptor';
import { AuthService, AppPro, AppUser } from './auth.service';
import { LiveService } from './live.service';
import { OrderService } from './order.service';
import { ProService } from './pro.service';
import { TrackingService } from './tracking.service';
import { WalletService } from './wallet.service';

describe('ProService dispatch authorization', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const user = signal<AppUser | null>(null);
  const pro = signal<AppPro | null>(null);
  const post = vi.fn();
  const currentLocation = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    user.set({ id, email: 'pro@example.test', role: 'PRO', fullName: 'Pro', phoneNumber: null, avatarKey: null });
    pro.set({ userId: id, isOnline: false, kycStatus: 'APPROVED', jobsDone: 0, ratingAvg: '0', ratingCount: 0 });
    post.mockRejectedValue(new ApiFailure(403, 'PRO_REQUIRED', 'This action requires a Pro account.'));
    TestBed.configureTestingModule({ providers: [
      ProService,
      { provide: ApiService, useValue: { settings: { useMockApi: () => false }, post } },
      { provide: AuthService, useValue: { user, pro } },
      { provide: TrackingService, useValue: { mode: () => 'live', currentLocation } },
      { provide: LiveService, useValue: { watch: vi.fn(() => () => undefined), events: { subscribe: () => ({ unsubscribe: vi.fn() }) } } },
      { provide: OrderService, useValue: {} },
      { provide: WalletService, useValue: { refresh: vi.fn() } },
      { provide: Router, useValue: { url: '/tabs/pro', navigateByUrl: vi.fn() } },
    ] });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('stops retrying a rejected background dispatch poll until the role changes', async () => {
    const service = TestBed.inject(ProService);
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    await service.poll();
    expect(post).toHaveBeenCalledTimes(1);
    expect(service.error()).toBe('This action requires a Pro account.');
  });

  it('allows dispatch polling again after switching away from and back to Pro', async () => {
    const service = TestBed.inject(ProService);
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    user.set({ ...user()!, role: 'CUSTOMER' });
    TestBed.tick();
    user.set({ ...user()!, role: 'PRO' });
    TestBed.tick();
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  });

  it('flips the availability toggle before the server answers', async () => {
    const service = TestBed.inject(ProService);
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    let answer!: (value: unknown) => void;
    currentLocation.mockResolvedValue({ lat: 17.6, lng: 121.7 });
    post.mockImplementation((path: string) => path === '/pro/availability' ? new Promise((resolve) => { answer = resolve; }) : Promise.resolve({ offer: null, serverNow: new Date().toISOString() }));
    const saving = service.availability(true);
    expect(service.online()).toBe(true);
    await vi.waitFor(() => expect(answer).toBeDefined());
    answer({ pro: { ...pro()!, isOnline: true } });
    await saving;
    expect(service.online()).toBe(true);
    expect(currentLocation).toHaveBeenCalledWith(30000);
  });

  it('reverts the toggle when going online fails', async () => {
    const service = TestBed.inject(ProService);
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    currentLocation.mockRejectedValue(new Error('Location permission denied.'));
    const saving = service.availability(true);
    expect(service.online()).toBe(true);
    await saving;
    expect(service.online()).toBe(false);
    expect(service.error()).toBe('Location permission denied.');
  });
});
