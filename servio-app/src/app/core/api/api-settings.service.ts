import { Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { environment } from '../../../environments/environment';

const SETTINGS_KEY = 'servioDemoConnection';
export interface ApiSettings { apiUrl: string; useMockApi: boolean }

@Injectable({ providedIn: 'root' })
export class ApiSettingsService {
  readonly apiUrl = signal(environment.apiUrl);
  readonly useMockApi = signal(environment.useMockApi);
  readonly ready = this.load();

  private async load(): Promise<void> {
    if (!environment.demo) return;
    const { value } = await Preferences.get({ key: SETTINGS_KEY });
    if (!value) return;
    try {
      const saved: unknown = JSON.parse(value);
      if (saved && typeof saved === 'object' && 'apiUrl' in saved && 'useMockApi' in saved && typeof saved.apiUrl === 'string' && typeof saved.useMockApi === 'boolean') {
        this.apiUrl.set(this.validUrl(saved.apiUrl)); this.useMockApi.set(saved.useMockApi);
      }
    } catch {}
  }

  async configure(settings: ApiSettings): Promise<void> {
    await this.ready;
    if (!environment.demo) throw new Error('Connection overrides are available only in demo builds.');
    const apiUrl = this.validUrl(settings.apiUrl);
    await Preferences.set({ key: SETTINGS_KEY, value: JSON.stringify({ apiUrl, useMockApi: settings.useMockApi }) });
    this.apiUrl.set(apiUrl); this.useMockApi.set(settings.useMockApi);
  }

  private validUrl(value: string): string {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !/\/api\/v1\/?$/.test(url.pathname)) {
      throw new Error('Use an API address ending in /api/v1, for example http://192.168.1.10:8787/api/v1.');
    }
    return url.toString().replace(/\/$/, '');
  }
}
