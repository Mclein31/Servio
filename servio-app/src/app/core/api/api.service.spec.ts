import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ToastController } from '@ionic/angular';
import { vi } from 'vitest';
import { ApiSettingsService } from './api-settings.service';
import { ApiFailure, apiInterceptor } from './api.interceptor';
import { ApiService } from './api.service';
import { AUTH_TOKEN_KEY, SessionService } from './session.service';

const preferences = vi.hoisted(() => new Map<string, string>());
vi.mock('@capacitor/preferences', () => ({ Preferences: {
  get: vi.fn(async ({ key }: { key: string }) => ({ value: preferences.get(key) ?? null })),
  set: vi.fn(async ({ key, value }: { key: string; value: string }) => { preferences.set(key, value); }),
  remove: vi.fn(async ({ key }: { key: string }) => { preferences.delete(key); }),
} }));

describe('SERVIO API client', () => {
  const toast = { present: vi.fn(async () => undefined) };
  const toasts = { create: vi.fn(async () => toast) };
  beforeEach(() => {
    preferences.clear(); vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([apiInterceptor])), provideHttpClientTesting(),
      { provide: ToastController, useValue: toasts }] });
  });
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); TestBed.resetTestingModule(); });

  it('persists a session and adds authorization/request ID only to SERVIO API requests', async () => {
    const sessions = TestBed.inject(SessionService); await sessions.set('opaque-session-test-token');
    const api = TestBed.inject(ApiService); await api.settings.ready;
    const pending = api.post<{ booking: { id: string } }>('/bookings', { skuId: 'sku-ac-leak' }, { 'Idempotency-Key': 'checkout-1' });
    await vi.waitFor(() => {
      const req = TestBed.inject(HttpTestingController).expectOne('http://localhost:8787/api/v1/bookings');
      expect(req.request.headers.get('Authorization')).toBe('Bearer opaque-session-test-token');
      expect(req.request.headers.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/);
      expect(req.request.headers.get('Idempotency-Key')).toBe('checkout-1');
      req.flush({ booking: { id: 'booking-1' } });
    });
    expect(await pending).toEqual({ booking: { id: 'booking-1' } });
    expect(preferences.get(AUTH_TOKEN_KEY)).toBe('opaque-session-test-token');
    TestBed.inject(HttpClient).get('https://storage.example.test/photo').subscribe();
    await vi.waitFor(() => {
      const req = TestBed.inject(HttpTestingController).expectOne('https://storage.example.test/photo');
      expect(req.request.headers.has('Authorization')).toBe(false); expect(req.request.headers.has('X-Request-Id')).toBe(false); req.flush({});
    });
  });

  it('supports a persisted LAN API address and offline mock selection for demo builds', async () => {
    const settings = TestBed.inject(ApiSettingsService); await settings.configure({ apiUrl: 'http://192.168.1.10:8787/api/v1/', useMockApi: false });
    expect(settings.apiUrl()).toBe('http://192.168.1.10:8787/api/v1'); expect(settings.useMockApi()).toBe(false);
    const promise = TestBed.inject(ApiService).get('/health');
    await vi.waitFor(() => { TestBed.inject(HttpTestingController).expectOne('http://192.168.1.10:8787/api/v1/health').flush({ status: 'ok' }); });
    expect(await promise).toEqual({ status: 'ok' });
    await settings.configure({ apiUrl: settings.apiUrl(), useMockApi: true }); expect(settings.useMockApi()).toBe(true);
    await expect(settings.configure({ apiUrl: 'file:///etc/passwd', useMockApi: false })).rejects.toThrow();
    await expect(settings.configure({ apiUrl: 'http://user:password@example.test/api/v1', useMockApi: false })).rejects.toThrow();
  });

  it('maps the API error envelope to a toast and clears rejected sessions', async () => {
    await TestBed.inject(SessionService).set('expired-session-test-token');
    const api = TestBed.inject(ApiService); await api.settings.ready;
    const result = api.get('/me').catch((error: unknown) => error);
    await vi.waitFor(() => { TestBed.inject(HttpTestingController).expectOne('http://localhost:8787/api/v1/me').flush({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in again.', requestId: 'request-1' } }, { status: 401, statusText: 'Unauthorized' }); });
    const error = await result;
    expect(error).toBeInstanceOf(ApiFailure); expect(error).toMatchObject({ status: 401, code: 'UNAUTHENTICATED', requestId: 'request-1' });
    expect(toasts.create).toHaveBeenCalledWith(expect.objectContaining({ message: 'Please sign in again.' }));
    await vi.waitFor(() => { expect(preferences.has(AUTH_TOKEN_KEY)).toBe(false); });
  });

  it('does not transmit offline mock tokens as bearer credentials', async () => {
    await TestBed.inject(SessionService).set('mock.offline-session');
    const api = TestBed.inject(ApiService); await api.settings.ready;
    const result = api.get('/health');
    await vi.waitFor(() => {
      const req = TestBed.inject(HttpTestingController).expectOne('http://localhost:8787/api/v1/health');
      expect(req.request.headers.has('Authorization')).toBe(false); req.flush({ status: 'ok' });
    });
    await result;
  });
});
