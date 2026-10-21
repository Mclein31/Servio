// geocoder tests
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '../src/env';
import { api, bookingFixture, hasDb } from './helpers';
import { addressFields, coordinates, Geocoder } from '../src/locations/geocoder';

const fixture = { address: { house_number: '12', road: 'Luna Street', suburb: 'Centro 10', city: 'Tuguegarao' } };
function setup() {
  const values = new Map<string, unknown>();
  const state = {
    storage: { get: async (key: string) => values.get(key), put: async (key: string, value: unknown) => { values.set(key, value); } },
    blockConcurrencyWhile: async <T>(callback: () => Promise<T>) => callback(),
  } as unknown as DurableObjectState;
  const bindings = { GEOCODING_URL: 'https://geocoder.example/reverse' } as Bindings;
  return { instance: new Geocoder(state, bindings), state, bindings };
}
const request = (lat = 17.613) => new Request(`https://internal/reverse?lat=${lat}&lng=121.727`);
afterEach(() => { vi.unstubAllGlobals(); });

describe('key-free address lookup', () => {
  it('maps Philippine barangays and municipalities without inventing a city from a province', () => {
    expect(addressFields(fixture)).toEqual({ street: '12 Luna Street', barangay: 'Centro 10', city: 'Tuguegarao' });
    expect(addressFields({ address: { village: 'Ugac Norte', county: 'Cagayan' } })).toEqual({ street: 'Ugac Norte', barangay: 'Ugac Norte', city: '' });
    expect(addressFields({ address: { municipality: 'Peñablanca', quarter: 'Callao' } })?.city).toBe('Peñablanca');
    expect(addressFields({ error: 'Unable to geocode' })).toBeNull();
  });
  it('rejects missing, blank, nonnumeric and out-of-range coordinates', () => {
    for (const query of ['', 'lat=&lng=', 'lat=NaN&lng=1', 'lat=91&lng=1', 'lat=1&lng=181']) expect(coordinates(new URL(`https://internal/?${query}`))).toBeNull();
    expect(coordinates(new URL('https://internal/?lat=0&lng=0'))).toEqual({ lat: 0, lng: 0 });
  });
  it('identifies requests, uses configurable upstream, caches across instances and enforces a global interval', async () => {
    const upstream = vi.fn(async () => Response.json(fixture)); vi.stubGlobal('fetch', upstream);
    const { instance, state, bindings } = setup();
    expect((await instance.fetch(request())).status).toBe(200);
    expect((await new Geocoder(state, bindings).fetch(request())).status).toBe(200);
    expect((await new Geocoder(state, bindings).fetch(request(17.614))).status).toBe(429);
    expect(upstream).toHaveBeenCalledTimes(1);
    const [url, options] = upstream.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.origin).toBe('https://geocoder.example');
    expect(new Headers(options.headers).get('User-Agent')).toContain('SERVIO/1.0');
  });
  it('rejects new requests while a slow lookup is running and returns recoverable upstream failures', async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
    const { instance } = setup();
    const pending = instance.fetch(request());
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    expect((await instance.fetch(request(17.614))).status).toBe(429);
    finish(new Response('unavailable', { status: 503 }));
    expect((await pending).status).toBe(503);
  });
});


describe.runIf(hasDb)('authenticated reverse-geocoding endpoint', () => {
  it('requires a real session and validates coordinates before contacting the provider', async () => {
    const f = await bookingFixture();
    try {
      expect((await api('/locations/reverse?lat=17&lng=121')).status).toBe(401);
      expect((await api('/locations/reverse?lat=&lng=121', { headers: f.headers.customer })).status).toBe(400);
    } finally { await f.close(); }
  });
});
