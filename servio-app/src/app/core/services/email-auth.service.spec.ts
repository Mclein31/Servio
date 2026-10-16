import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ApiService } from '../api/api.service';
import { SessionService } from '../api/session.service';
import { AppUser, AuthService } from './auth.service';

const newUser: AppUser = { id: 'customer-id', email: 'person@example.test', role: 'CUSTOMER', fullName: null, phoneNumber: null, avatarKey: null };

describe('email-code auth', () => {
  const settings = { ready: Promise.resolve(), useMockApi: signal(false) };
  const api = { settings, post: vi.fn(), get: vi.fn(), patch: vi.fn() };
  const token = signal<string | null>(null);
  const sessions = { token, get: vi.fn(async () => token()), set: vi.fn(async (value: string) => token.set(value)), clear: vi.fn(async () => token.set(null)) };
  beforeEach(() => {
    vi.clearAllMocks(); token.set(null); settings.useMockApi.set(false);
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }, { provide: SessionService, useValue: sessions }] });
    api.post.mockReset(); api.get.mockReset(); api.patch.mockReset();
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.unstubAllGlobals(); });

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
});
