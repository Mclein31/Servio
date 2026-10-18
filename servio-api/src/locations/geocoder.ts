import type { Bindings } from '../env';

export interface AddressFields { street: string; barangay: string; city: string }
export function addressFields(payload: unknown): AddressFields | null {
  if (!payload || typeof payload !== 'object' || !('address' in payload)) return null;
  const address = payload.address;
  if (!address || typeof address !== 'object') return null;
  const fields = address as Record<string, unknown>;
  const first = (...keys: string[]) => keys.map((key) => fields[key]).find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim() ?? '';
  return {
    street: [first('house_number'), first('road', 'pedestrian', 'residential', 'path')].filter(Boolean).join(' ') || first('suburb', 'quarter', 'neighbourhood', 'village'),
    barangay: first('suburb', 'quarter', 'neighbourhood', 'village'),
    // A county/province is not a city. Leave missing fields editable instead of guessing.
    city: first('city', 'town', 'municipality'),
  };
}

export function coordinates(url: URL): { lat: number; lng: number } | null {
  const latText = url.searchParams.get('lat'); const lngText = url.searchParams.get('lng');
  if (!latText?.trim() || !lngText?.trim()) return null;
  const lat = Number(latText); const lng = Number(lngText);
  return Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

type Cached = { value: AddressFields; expires: number };
const unavailable = () => Response.json({ error: { code: 'GEOCODING_UNAVAILABLE', message: 'Address lookup is unavailable. Please enter your address manually.' } }, { status: 503 });

/** One named instance for the entire app, including every Worker isolate. */
export class Geocoder {
  private inFlight = false;
  constructor(private readonly state: DurableObjectState, private readonly env: Bindings) {}

  async fetch(request: Request): Promise<Response> {
    const point = coordinates(new URL(request.url));
    if (!point) return Response.json({ error: { code: 'BAD_REQUEST', message: 'Valid latitude and longitude are required.' } }, { status: 400 });
    const key = `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
    const admission = await this.state.blockConcurrencyWhile(async () => {
      const cache = await this.state.storage.get<Record<string, Cached>>('cache') ?? {};
      if (cache[key] && cache[key].expires > Date.now()) return Response.json(cache[key].value);
      const next = await this.state.storage.get<number>('nextRequestAt') ?? 0;
      if (this.inFlight || Date.now() < next) return Response.json({ error: { code: 'GEOCODING_BUSY', message: 'Address lookup is busy. Please try the pin again shortly.' } }, { status: 429, headers: { 'Retry-After': '1' } });
      await this.state.storage.put('nextRequestAt', Date.now() + 1100);
      this.inFlight = true;
      return null;
    });
    if (admission) return admission;
    try {
      const url = new URL(this.env.GEOCODING_URL || 'https://nominatim.openstreetmap.org/reverse');
      url.searchParams.set('lat', String(point.lat)); url.searchParams.set('lon', String(point.lng));
      url.searchParams.set('format', 'jsonv2'); url.searchParams.set('addressdetails', '1'); url.searchParams.set('accept-language', 'en');
      const response = await fetch(url, { headers: { 'User-Agent': 'SERVIO/1.0 (https://servio-api.mcleinonza0531.workers.dev)', Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) return unavailable();
      const result = addressFields(await response.json());
      if (!result) return unavailable();
      await this.state.blockConcurrencyWhile(async () => {
        const cache = await this.state.storage.get<Record<string, Cached>>('cache') ?? {};
        const entries = Object.entries(cache).filter(([, item]) => item.expires > Date.now()).slice(-255);
        await this.state.storage.put('cache', { ...Object.fromEntries(entries), [key]: { value: result, expires: Date.now() + 7 * 86400000 } });
      });
      return Response.json(result);
    } catch { return unavailable(); }
    finally { this.inFlight = false; }
  }
}
