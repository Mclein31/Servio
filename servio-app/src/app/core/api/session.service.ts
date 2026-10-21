// session
import { Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

export const AUTH_TOKEN_KEY = 'servioAuthToken';

@Injectable({ providedIn: 'root' })
export class SessionService {
  readonly token = signal<string | null | undefined>(undefined);
  private loading?: Promise<string | null>;
  private revision = 0;

  async get(): Promise<string | null> {
    if (this.token() !== undefined) return this.token() ?? null;
    if (!this.loading) {
      const revision = this.revision;
      this.loading = Preferences.get({ key: AUTH_TOKEN_KEY }).then(({ value }) => {
        if (revision === this.revision) this.token.set(value);
        return this.token() ?? null;
      }).finally(() => { this.loading = undefined; });
    }
    return this.loading;
  }
  async set(token: string): Promise<void> {
    this.revision++;
    await Preferences.set({ key: AUTH_TOKEN_KEY, value: token }); this.token.set(token);
  }
  async clear(): Promise<void> {
    this.revision++; this.token.set(null);
    await Preferences.remove({ key: AUTH_TOKEN_KEY });
  }
}
