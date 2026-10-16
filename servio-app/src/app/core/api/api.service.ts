import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiSettingsService } from './api-settings.service';

export type UploadPurpose = 'addon_evidence' | 'kyc' | 'request_photo' | 'avatar';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  readonly settings = inject(ApiSettingsService);

  async request<T>(method: string, path: string, body?: unknown, options: { headers?: Record<string,string>; query?: Record<string,string | number> } = {}): Promise<T> {
    await this.settings.ready;
    if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Use an API-relative path.');
    if (!this.settings.apiUrl()) throw new Error('The SERVIO API address is not configured.');
    let params = new HttpParams();
    for (const [key,value] of Object.entries(options.query ?? {})) params = params.set(key, String(value));
    return firstValueFrom(this.http.request<T>(method, this.settings.apiUrl() + path, { body, params, cache: 'no-store', headers: new HttpHeaders(options.headers) }));
  }
  get<T>(path: string, query?: Record<string,string | number>) { return this.request<T>('GET', path, undefined, { query }); }
  post<T>(path: string, body: unknown, headers?: Record<string,string>) { return this.request<T>('POST', path, body, { headers }); }
  patch<T>(path: string, body: unknown) { return this.request<T>('PATCH', path, body); }

  async upload(blob: Blob, purpose: UploadPurpose): Promise<string> {
    const signed = await this.post<{ key: string; uploadUrl: string }>('/uploads/presign', { purpose, contentType: blob.type, contentLength: blob.size });
    // Browsers set Content-Length for the Blob. Never send the API bearer token to a signed storage URL.
    const response = await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob });
    if (!response.ok) throw new Error('The photo could not be uploaded. Please try again.');
    return signed.key;
  }
  async imageUrl(key: string): Promise<string> {
    return (await this.get<{ downloadUrl: string }>(`/uploads/${key}`)).downloadUrl;
  }
}
