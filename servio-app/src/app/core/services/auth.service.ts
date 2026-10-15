import { Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

export const ONBOARDING_KEY = 'hasSeenOnboarding';
export const AUTH_TOKEN_KEY = 'servioAuthToken';
export const TEST_OTP = '123456';

/** Philippine mobile: 10 national digits starting with 9 (e.g. 917 123 4567). */
export const PH_MOBILE_PATTERN = /^9\d{9}$/;

/** "9171234567" → "917 123 4567" (partial input formats progressively). */
export function formatPhLocal(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)].filter(Boolean).join(' ');
}

/**
 * Mock passwordless auth. sendOtp/verifyOtp stand in for the SMS provider;
 * the token is a local placeholder, not a credential.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly pendingPhone = signal<string | null>(null);
  private cachedToken: string | null | undefined;

  async hasSeenOnboarding(): Promise<boolean> {
    const { value } = await Preferences.get({ key: ONBOARDING_KEY });
    return value === 'true';
  }

  async markOnboardingSeen(): Promise<void> {
    await Preferences.set({ key: ONBOARDING_KEY, value: 'true' });
  }

  async isAuthenticated(): Promise<boolean> {
    if (this.cachedToken === undefined) {
      this.cachedToken = (await Preferences.get({ key: AUTH_TOKEN_KEY })).value;
    }
    return !!this.cachedToken;
  }

  /** `phone` is E.164, e.g. +639171234567. */
  async sendOtp(phone: string): Promise<void> {
    this.pendingPhone.set(phone);
    await new Promise((r) => setTimeout(r, 450)); // simulated SMS gateway latency
  }

  /** Mock: accepts any 6 digits (test code 123456). */
  async verifyOtp(phone: string, code: string): Promise<boolean> {
    await new Promise((r) => setTimeout(r, 350));
    if (!/^\d{6}$/.test(code)) return false;
    const token = `mock.${btoa(phone)}.${Date.now()}`;
    await Preferences.set({ key: AUTH_TOKEN_KEY, value: token });
    this.cachedToken = token;
    return true;
  }

  async logout(): Promise<void> {
    await Preferences.remove({ key: AUTH_TOKEN_KEY });
    this.cachedToken = null;
  }
}
