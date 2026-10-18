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

  private async normalizeUploadBlob(blob: Blob): Promise<{ blob: Blob; contentType: 'image/jpeg' | 'image/png' }> {
    const maxBytes = 5 * 1024 * 1024;
    const type = blob.type.toLowerCase();
    const canUseDirect = type === 'image/png' || type === 'image/jpeg';
    let file = canUseDirect ? blob : await this.convertToJpeg(blob);
    let contentType: 'image/jpeg' | 'image/png' = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    if (file.size > maxBytes) {
      file = await this.scaleToLimit(file, contentType, maxBytes);
    }
    if (file.size > maxBytes) throw new Error('The photo must be a JPEG or PNG under 5 MB.');
    return { blob: file, contentType };
  }

  private async convertToJpeg(blob: Blob): Promise<Blob> {
    const url = URL.createObjectURL(blob);
    try {
      const image = await this.loadImage(url);
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) return new Blob([blob], { type: 'image/jpeg' });
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((next) => next ? resolve(next) : reject(new Error('Could not convert the selected photo.')), 'image/jpeg', 0.82);
      });
    } finally { URL.revokeObjectURL(url); }
  }

  private async scaleToLimit(blob: Blob, contentType: 'image/jpeg' | 'image/png', maxBytes: number): Promise<Blob> {
    const url = URL.createObjectURL(blob);
    try {
      const image = await this.loadImage(url);
      const canvas = document.createElement('canvas');
      let width = image.width; let height = image.height;
      let scale = 1;
      while (blob.size > maxBytes && scale > 0.2) {
        scale *= 0.85;
        width = Math.max(1, Math.round(image.width * scale));
        height = Math.max(1, Math.round(image.height * scale));
        canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) break;
        context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height); context.drawImage(image, 0, 0, width, height);
        const next = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Could not resize the selected photo.')), contentType, contentType === 'image/png' ? 0.9 : 0.82);
        });
        if (next.size >= blob.size) break;
        blob = next; 
      }
      return blob;
    } finally { URL.revokeObjectURL(url); }
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('The selected photo could not be read. Please choose a different image.'));
      image.src = url;
    });
  }

  async upload(blob: Blob, purpose: UploadPurpose): Promise<string> {
    const { blob: uploadBlob, contentType } = await this.normalizeUploadBlob(blob);
    const signed = await this.post<{ key: string; uploadUrl: string }>('/uploads/presign', { purpose, contentType, contentLength: uploadBlob.size });
    // Browsers set Content-Length for the Blob. Never send the API bearer token to a signed storage URL.
    const response = await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: uploadBlob });
    if (!response.ok) throw new Error('The photo could not be uploaded. Please try again.');
    return signed.key;
  }
  async imageUrl(key: string): Promise<string> {
    return (await this.get<{ downloadUrl: string }>(`/uploads/${key}`)).downloadUrl;
  }
}
