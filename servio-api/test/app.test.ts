import { describe, expect, it } from 'vitest';
import { api, hasDb } from './helpers';

describe('app shell', () => {
  it('unknown routes return the error envelope with a request id', async () => {
    const res = await api('/nope');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string; requestId: string } };
    expect(body.error.code).toBe('NOT_FOUND');
    expect(res.headers.get('X-Request-Id')).toBe(body.error.requestId);
  });

  it('allows the Capacitor iOS origin and rejects unknown origins', async () => {
    const ok = await api('/health', { headers: { Origin: 'capacitor://localhost' } });
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('capacitor://localhost');
    const bad = await api('/health', { headers: { Origin: 'https://evil.example' } });
    expect(bad.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it.runIf(hasDb)('health reports the database as ok', async () => {
    const res = await api('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'ok', database: 'ok' });
  });

  it.runIf(hasDb)('catalog lists categories, SKUs and add-ons in centavos', async () => {
    const res = await api('/catalog');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { trustFeeCentavos: number; categories: unknown[]; skus: { id: string; priceCentavos: number }[]; addons: { id: string; priceCentavos: number }[] };
    expect(body.trustFeeCentavos).toBe(5000);
    expect(body.categories.length).toBe(5);
    expect(body.skus.find((s) => s.id === 'sku-ac-leak')?.priceCentavos).toBe(110000);
    expect(body.addons.find((a) => a.id === 'addon-drain-hose')?.priceCentavos).toBe(35000);
  });
});
