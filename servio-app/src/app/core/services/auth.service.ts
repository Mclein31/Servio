import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { ApiService } from '../api/api.service';
import { SessionService } from '../api/session.service';
import { clearDemoState } from './demo-store';

export { AUTH_TOKEN_KEY } from '../api/session.service';
export const ONBOARDING_KEY = 'hasSeenOnboarding';
export const TEST_OTP = '123456';
export const PH_MOBILE_PATTERN = /^9\d{9}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function formatPhLocal(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)].filter(Boolean).join(' ');
}
export interface AppUser {
  isDemo?: boolean; id: string; email: string; role: 'CUSTOMER' | 'PRO' | 'ADMIN'; fullName: string | null; phoneNumber: string | null; avatarKey: string | null;
}
export interface AppPro {
  userId: string; isOnline: boolean; kycStatus: string; jobsDone: number; ratingAvg: string; ratingCount: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly sessions = inject(SessionService);
  readonly settings = this.api.settings;
  readonly pendingEmail = signal<string | null>(null);
  readonly devNote = signal<string | null>(null);
  readonly user = signal<AppUser | null>(null);
  readonly avatarUrl = signal('');
  readonly pro = signal<AppPro | null>(null);
  readonly needsProfile = computed(() => !this.user()?.fullName);
  private loadedToken?: string;
  private profileLoading?: { token: string; promise: Promise<void> };

  constructor() {
    effect(() => {
      if (!this.sessions.token()) { this.user.set(null); this.avatarUrl.set(''); this.pro.set(null); this.loadedToken = undefined; }
    });
  }

  async hasSeenOnboarding(): Promise<boolean> { return (await Preferences.get({ key: ONBOARDING_KEY })).value === 'true'; }
  async markOnboardingSeen(): Promise<void> { await Preferences.set({ key: ONBOARDING_KEY, value: 'true' }); }

  async isAuthenticated(): Promise<boolean> {
    await this.settings.ready;
    const token = await this.sessions.get();
    if (!token || (!this.settings.useMockApi() && token.startsWith('mock.'))) return false;
    try { await this.refreshProfile(); return this.sessions.token() === token && this.user() !== null; } catch { return false; }
  }
  async refreshProfile(force = false): Promise<void> {
    const token = await this.sessions.get();
    if (!token) { this.user.set(null); this.avatarUrl.set(''); this.pro.set(null); return; }
    if (!force && this.loadedToken === token && this.user()) return;
    if (this.profileLoading?.token !== token) {
      const promise = (async () => {
        if (this.settings.useMockApi()) {
          this.user.set({ id: 'mock-customer', email: this.pendingEmail() ?? 'demo.customer@servio.test', fullName: 'Sophia M.', role: 'CUSTOMER', phoneNumber: null, avatarKey: null });
          this.pro.set(null);
        } else {
          const result = await this.api.get<{ me: AppUser; pro: AppPro | null }>('/me');
          if (this.sessions.token() !== token) return;
          this.user.set(result.me); this.pro.set(result.pro);
          await this.loadAvatar(result.me,token);
        }
        this.loadedToken = token;
      })().finally(() => { if (this.profileLoading?.token === token) this.profileLoading = undefined; });
      this.profileLoading = { token, promise };
    }
    await this.profileLoading.promise;
  }

  async sendOtp(email: string): Promise<void> {
    await this.settings.ready;
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) throw new Error('Enter a valid email address.');
    this.devNote.set(null);
    if (!this.settings.useMockApi()) {
      const result = await this.api.post<{ devNote?: string }>('/auth/request-code', { email: normalized });
      this.devNote.set(result.devNote ?? null);
    }
    this.pendingEmail.set(normalized);
  }
  async verifyOtp(email: string, code: string): Promise<boolean> {
    if (!/^\d{6}$/.test(code)) return false;
    await this.settings.ready;
    if (this.settings.useMockApi()) {
      if (code !== TEST_OTP) return false;
      await this.sessions.set(`mock.${crypto.randomUUID()}`);
    }
    else {
      const session = await this.api.post<{ accessToken: string }>('/auth/verify-code', { email: email.trim().toLowerCase(), code });
      await this.sessions.set(session.accessToken);
    }
    this.loadedToken = undefined;
    await this.refreshProfile(true);
    return true;
  }
  async updateProfile(fullName: string, phoneNumber: string | null, avatarKey?: string | null): Promise<void> {
    if (this.settings.useMockApi()) this.user.update((u) => u ? { ...u, fullName, phoneNumber, ...(avatarKey!==undefined?{ avatarKey }: {}) } : u);
    else {
      const token = this.sessions.token();
      const result = await this.api.patch<{ me: AppUser }>('/me', { fullName, phoneNumber, ...(avatarKey!==undefined?{ avatarKey }: {}) });
      if (this.sessions.token() === token) { this.user.set(result.me); if(token) await this.loadAvatar(result.me,token); }
    }
  }
  private async loadAvatar(user: AppUser, token: string): Promise<void> {
    const url=user.avatarKey ? await this.api.imageUrl(user.avatarKey).catch(()=>'') : '';
    if(this.sessions.token()===token && this.user()?.avatarKey===user.avatarKey) this.avatarUrl.set(url);
  }

  async upgradeToPro(categoryId?: string, headline?: string): Promise<void> {
    if (this.settings.useMockApi()) {
      this.user.update((u) => u ? { ...u, role: 'PRO' } : u);
      this.pro.set({
        userId: this.user()?.id ?? 'mock-customer',
        isOnline: false,
        kycStatus: 'APPROVED',
        jobsDone: 0,
        ratingAvg: '5.00',
        ratingCount: 1,
      });
      return;
    }
    const token = this.sessions.token();
    const cleanCategory = typeof categoryId === 'string'
      ? categoryId
      : (categoryId && typeof categoryId === 'object' ? (categoryId as any).category || (categoryId as any).value : undefined);
    const body = cleanCategory ? { categoryId: cleanCategory, ...(headline ? { headline } : {}) } : {};
    const result = await this.api.post<{ me: AppUser; pro: AppPro | null }>('/me/upgrade-pro', body);
    if (this.sessions.token() === token) {
      this.user.set(result.me);
      this.pro.set(result.pro);
    }
  }

  async updateTrade(categoryId: string, headline?: string): Promise<void> {
    if (this.settings.useMockApi()) return;
    const token = this.sessions.token();
    const cleanCategory = typeof categoryId === 'string'
      ? categoryId
      : (categoryId && typeof categoryId === 'object' ? (categoryId as any).category || (categoryId as any).value || 'repairs' : 'repairs');
    const body = { categoryId: cleanCategory, ...(headline ? { headline } : {}) };
    const result = await this.api.post<{ me: AppUser; pro: AppPro | null }>('/me/pro-trade', body);
    if (this.sessions.token() === token) {
      this.user.set(result.me);
      this.pro.set(result.pro);
    }
  }

  async switchRole(role: 'CUSTOMER' | 'PRO'): Promise<void> {
    if (this.settings.useMockApi()) {
      this.user.update((u) => u ? { ...u, role } : u);
      if (role === 'PRO') {
        this.pro.update((p) => p ? { ...p, isOnline: false } : {
          userId: this.user()?.id ?? 'mock-customer',
          isOnline: false,
          kycStatus: 'APPROVED',
          jobsDone: 0,
          ratingAvg: '5.00',
          ratingCount: 1,
        });
      } else {
        this.pro.update((p) => p ? { ...p, isOnline: false } : null);
      }
      return;
    }
    const token = this.sessions.token();
    const result = await this.api.post<{ me: AppUser; pro: AppPro | null }>('/me/switch-role', { role });
    if (this.sessions.token() === token) {
      this.user.set(result.me);
      this.pro.set(result.pro);
    }
  }

  landingPath(): string { return this.needsProfile() ? '/auth/profile' : this.user()?.role === 'PRO' ? '/pro' : '/tabs/home'; }

  async clearLocal(): Promise<void> {
    this.loadedToken = undefined; this.user.set(null); this.avatarUrl.set(''); this.pro.set(null);
    await this.sessions.clear(); clearDemoState();
  }
  async logout(): Promise<void> {
    try { if (!this.settings.useMockApi()) await this.api.post('/auth/sign-out', {}); }
    finally { await this.clearLocal(); }
  }
}
