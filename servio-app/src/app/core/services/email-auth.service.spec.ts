import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ApiService } from '../api/api.service';
import { SessionService } from '../api/session.service';
import { AppUser, AuthService } from './auth.service';

const newUser: AppUser = { id: 'customer-id', email: 'person@example.test', role: 'CUSTOMER', fullName: null, phoneNumber: null, avatarKey: null };

describe('email-code auth', () => {
  const settings = { ready: Promise.resolve(), useMockApi: signal(false) };
  const api = { settings, post: vi.fn(), get: vi.fn(), patch: vi.fn(), imageUrl:vi.fn() };
  const token = signal<string | null>(null);
  const sessions = { token, get: vi.fn(async () => token()), set: vi.fn(async (value: string) => token.set(value)), clear: vi.fn(async () => token.set(null)) };
  beforeEach(() => {
    vi.clearAllMocks(); token.set(null); settings.useMockApi.set(false);
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }, { provide: SessionService, useValue: sessions }] });
    api.post.mockReset(); api.get.mockReset(); api.patch.mockReset();
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.unstubAllGlobals(); });

  it('makes the authenticated account ready before its avatar is available',async()=>{
    token.set('session');const auth=TestBed.inject(AuthService);
    api.get.mockResolvedValue({me:{...newUser,fullName:'Ready User',avatarKey:'avatar'},pro:null});
    let resolve!:(url:string)=>void;api.imageUrl.mockReturnValue(new Promise<string>(r=>resolve=r));
    await auth.refreshProfile();expect(auth.user()?.fullName).toBe('Ready User');
    resolve('signed-avatar');await vi.waitFor(()=>expect(auth.avatarUrl()).toBe('signed-avatar'));
  });
  it('normalizes email, displays the dev note, verifies via API and saves the returned session', async () => {
    const auth = TestBed.inject(AuthService);
    api.post.mockResolvedValueOnce({ devNote: 'Development: use the API log.' });
    await auth.sendOtp(' Person@Example.Test ');
    expect(api.post).toHaveBeenCalledWith('/auth/request-code', { email: 'person@example.test' });
    expect(auth.devNote()).toContain('API log');
    api.post.mockResolvedValueOnce({ accessToken: 'opaque-test-session' }); api.get.mockResolvedValueOnce({ me: newUser, pro: null });
    expect(await auth.verifyOtp('person@example.test', '246810')).toBe(true);
    expect(api.post).toHaveBeenLastCalledWith('/auth/verify-code', { email: 'person@example.test', code: '246810' });
    expect(sessions.set).toHaveBeenCalledWith('opaque-test-session');
    expect(auth.landingPath()).toBe('/auth/profile');
    api.patch.mockResolvedValueOnce({ me: { ...newUser, fullName: 'Example Person', phoneNumber: '+639171234567' } });
    await auth.updateProfile('Example Person', '+639171234567');
    expect(api.patch).toHaveBeenCalledWith('/me', { fullName: 'Example Person', phoneNumber: '+639171234567' });
    expect(auth.landingPath()).toBe('/tabs/home');
    token.set(null); TestBed.tick();
    expect(auth.user()).toBeNull(); expect(auth.pro()).toBeNull();
  });

  it('routes an existing Pro to the Pro app and does not treat a mock token as live auth', async () => {
    const auth = TestBed.inject(AuthService); token.set('mock.previous-demo');
    expect(await auth.isAuthenticated()).toBe(false);
    token.set('opaque-pro-session');
    api.get.mockResolvedValueOnce({ me: { ...newUser, fullName: 'Daniel K.', role: 'PRO' }, pro: { isOnline: true } });
    expect(await auth.isAuthenticated()).toBe(true); expect(auth.landingPath()).toBe('/pro');
  });

  it('retains offline email-code demos without calling the API', async () => {
    settings.useMockApi.set(true);
    const auth = TestBed.inject(AuthService);
    await auth.sendOtp('demo.customer@servio.test');
    expect(await auth.verifyOtp('demo.customer@servio.test', '000000')).toBe(false);
    expect(await auth.verifyOtp('demo.customer@servio.test', '123456')).toBe(true);
    expect(api.post).not.toHaveBeenCalled(); expect(api.get).not.toHaveBeenCalled();
    expect(token()).toMatch(/^mock\./); expect(auth.user()?.fullName).toBe('Sophia M.');
  });

  it('ignores a profile response that arrives after sign-out', async () => {
    const auth = TestBed.inject(AuthService); token.set('old-session');
    let finish!: (value: unknown) => void;
    api.get.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const authenticated = auth.isAuthenticated();
    await vi.waitFor(() => expect(api.get).toHaveBeenCalled());
    await auth.clearLocal();
    finish({ me: { ...newUser, fullName: 'Old User' }, pro: null });
    expect(await authenticated).toBe(false); expect(auth.user()).toBeNull();
  });

  it('rejects malformed input and never leaves a rejected code authenticated', async () => {
    const auth = TestBed.inject(AuthService);
    await expect(auth.sendOtp('invalid')).rejects.toThrow('valid email');
    expect(await auth.verifyOtp('person@example.test', '123')).toBe(false);
    api.post.mockRejectedValueOnce(new Error('Invalid code'));
    await expect(auth.verifyOtp('person@example.test', '000000')).rejects.toThrow('Invalid code');
    expect(token()).toBeNull(); expect(sessions.set).not.toHaveBeenCalled();
  });

  it('upgrades a customer to Pro and switches role via API and mock mode', async () => {
    const auth = TestBed.inject(AuthService);
    token.set('valid-token');
    auth.user.set({ ...newUser, fullName: 'Test User' });
    const approvedPro = { userId: 'customer-id', isOnline: false, kycStatus: 'APPROVED', jobsDone: 0, ratingAvg: '5.00', ratingCount: 1 };
    api.post.mockResolvedValueOnce({
      me: { ...newUser, fullName: 'Test User', role: 'PRO' },
      pro: approvedPro,
    });
    await auth.upgradeToPro();
    expect(api.post).toHaveBeenCalledWith('/me/upgrade-pro', {});
    expect(auth.user()?.role).toBe('PRO');
    expect(auth.pro()?.kycStatus).toBe('APPROVED');
    expect(auth.pro()?.isOnline).toBe(false);

    api.post.mockResolvedValueOnce({
      me: { ...newUser, fullName: 'Test User', role: 'CUSTOMER' },
      pro: { ...approvedPro, isOnline: false },
    });
    await auth.switchRole('CUSTOMER');
    expect(api.post).toHaveBeenCalledWith('/me/switch-role', { role: 'CUSTOMER' });
    expect(auth.user()?.role).toBe('CUSTOMER');
    expect(auth.pro()?.kycStatus).toBe('APPROVED');
    expect(auth.pro()?.isOnline).toBe(false);

    api.post.mockResolvedValueOnce({
      me: { ...newUser, fullName: 'Test User', role: 'PRO' },
      pro: { ...approvedPro, isOnline: false },
    });
    await auth.switchRole('PRO');
    expect(api.post).toHaveBeenCalledWith('/me/switch-role', { role: 'PRO' });
    expect(auth.user()?.role).toBe('PRO');
    expect(auth.pro()?.kycStatus).toBe('APPROVED');

    // Test in mock mode
    settings.useMockApi.set(true);
    await auth.upgradeToPro();
    expect(auth.user()?.role).toBe('PRO');
    expect(auth.pro()?.kycStatus).toBe('APPROVED');
    expect(auth.pro()?.isOnline).toBe(false);

    await auth.switchRole('CUSTOMER');
    expect(auth.user()?.role).toBe('CUSTOMER');
    expect(auth.pro()?.isOnline).toBe(false);

    await auth.switchRole('PRO');
    expect(auth.user()?.role).toBe('PRO');
    expect(auth.pro()?.isOnline).toBe(false);
  });
});
