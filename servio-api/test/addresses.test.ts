// address tests
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bookings, ledgerEntries, userAddresses } from '../src/db/schema';
import { api, bookingFixture, hasDb, json } from './helpers';

const home = { label: 'Home', street: 'Ugac Norte', barangay: 'Ugac Norte', city: 'Tuguegarao City', landmark: 'Near Bassig Street', lat: 17.618111, lng: 121.718927 };
type Address = typeof userAddresses.$inferSelect;

describe.runIf(hasDb)('owner saved service addresses', () => {
  let f: Awaited<ReturnType<typeof bookingFixture>>;
  beforeEach(async () => { f = await bookingFixture(); });
  afterEach(async () => { await f.close(); });
  const create = (body: unknown = home, headers?: Record<string, string>) => api('/me/addresses', json(body, headers ?? f.headers.customer));
  const patch = (id: string, body: unknown, headers?: Record<string, string>) => api(`/me/addresses/${id}`, { ...json(body, headers ?? f.headers.customer), method: 'PATCH' });
  const remove = (id: string, headers?: Record<string, string>) => api(`/me/addresses/${id}`, { method: 'DELETE', headers: headers ?? f.headers.customer });
  const list = async (headers?: Record<string, string>) => (await (await api('/me/addresses', { headers: headers ?? f.headers.customer })).json() as { addresses: Address[] }).addresses;
  const saved = async (body: unknown = home) => {
    const response = await create(body);
    expect(response.status).toBe(201);
    return (await response.json() as { address: Address }).address;
  };

  it('creates, edits and promotes defaults without rewriting booked destinations or any ledger entry', async () => {
    const ledger = await f.db.select().from(ledgerEntries).where(eq(ledgerEntries.bookingId, f.booking.id));
    expect(await list()).toEqual([]);
    const first = await saved({ ...home, label: '  Home  ', isDefault: false });
    expect(first).toMatchObject({ ...home, isDefault: true });
    expect(first).not.toHaveProperty('userId');
    const second = await saved({ ...home, label: 'Family', street: 'Centro 10', barangay: 'Centro 10', lat: 17.6132, lng: 121.73025 });
    expect(second.isDefault).toBe(false);
    expect((await patch(second.id, { isDefault: true })).status).toBe(200);
    expect((await list()).map((row) => [row.id, row.isDefault])).toEqual([[second.id, true], [first.id, false]]);
    expect((await patch(second.id, { label: 'Office', street: 'Centro 5', landmark: null })).status).toBe(200);
    expect((await remove(second.id)).status).toBe(200);
    expect(await list()).toMatchObject([{ id: first.id, isDefault: true }]);
    const [booking] = await f.db.select().from(bookings).where(eq(bookings.id, f.booking.id));
    expect(booking!.address).toEqual(f.booking.address);
    expect(await f.db.select().from(ledgerEntries).where(eq(ledgerEntries.bookingId, f.booking.id))).toEqual(ledger);
    expect((await remove(first.id)).status).toBe(200);
    expect(await list()).toEqual([]);
  });

  it('requires authentication and returns no other owner address through reads or writes', async () => {
    const address = await saved();
    expect((await api('/me/addresses')).status).toBe(401);
    expect((await create(home, {})).status).toBe(401);
    expect((await patch(address.id, { label: 'Other' }, {})).status).toBe(401);
    expect((await remove(address.id, {})).status).toBe(401);
    expect(await list(f.headers.other)).toEqual([]);
    expect((await patch(address.id, { label: 'Other' }, f.headers.other)).status).toBe(404);
    expect((await remove(address.id, f.headers.other)).status).toBe(404);
    expect((await remove(crypto.randomUUID())).status).toBe(404);
    expect((await patch('not-an-id', { label: 'Other' })).status).toBe(422);
  });

  it('rejects malformed locations and invalid partial edits before any money changes', async () => {
    for (const input of [
      { ...home, street: '' }, { ...home, label: 'x'.repeat(51) }, { ...home, lat: 91 },
      { ...home, lat: '17.613' }, { ...home, userId: f.pro.id },
      { ...home, isDefault: 'true' }, { ...home, price: 1 },
    ]) expect((await create(input)).status).toBe(422);
    const address = await saved();
    for (const input of [{}, { isDefault: false }, { lng: 181 }, { userId: f.pro.id }]) expect((await patch(address.id, input)).status).toBe(422);
    expect(await list()).toMatchObject([{ id: address.id, ...home, isDefault: true }]);
    const original = await f.db.select().from(ledgerEntries).where(eq(ledgerEntries.bookingId, f.booking.id));
    const response = await api('/bookings', json({ skuId: 'sku-ac-leak', address: { street: home.street, barangay: home.barangay, city: home.city }, lat: 91, lng: 0, schedule: 'ASAP', paymentMethod: 'GCASH' }, f.headers.customer));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
    expect(await f.db.select().from(ledgerEntries).where(eq(ledgerEntries.bookingId, f.booking.id))).toEqual(original);
  });

  it('accepts and preserves locations outside Tuguegarao for addresses and bookings', async () => {
    const away = { ...home, city: 'Peñablanca' };
    const address = await saved(away);
    expect(address.city).toBe('Peñablanca');
    expect((await patch(address.id, { city: 'Iguig' })).status).toBe(200);
    expect(await list()).toMatchObject([{ id: address.id, city: 'Iguig' }]);
    const booking = await api('/bookings', json({
      skuId: 'sku-ac-leak', address: { street: away.street, barangay: away.barangay, city: away.city },
      lat: 17.35, lng: 121.8, schedule: 'ASAP', paymentMethod: 'GCASH',
    }, f.headers.customer));
    expect(booking.status).toBe(201);
    expect(await booking.json()).toMatchObject({ booking: { address: { city: 'Peñablanca' }, lat: 17.35, lng: 121.8 } });
  });

  it('accepts saving and editing pins beyond the former 10 km radius', async () => {
    const address = await saved({ ...home, lat: 17.72, lng: 121.8 });
    expect((await patch(address.id, { lat: 17.75, lng: 121.85 })).status).toBe(200);
    expect(await list()).toMatchObject([{ id: address.id, lat: 17.75, lng: 121.85 }]);
  });

  it('serializes simultaneous first addresses and default changes, maintaining exactly one default', async () => {
    const responses = await Promise.all([create({ ...home, label: 'One' }), create({ ...home, label: 'Two' })]);
    expect(responses.map((row) => row.status)).toEqual([201, 201]);
    const addresses = await list();
    expect(addresses.filter((row) => row.isDefault)).toHaveLength(1);
    const changes = await Promise.all(addresses.map((row) => patch(row.id, { isDefault: true })));
    expect(changes.map((row) => row.status)).toEqual([200, 200]);
    expect((await list()).filter((row) => row.isDefault)).toHaveLength(1);
    const deleted = await Promise.all(addresses.map((row) => remove(row.id)));
    expect(deleted.map((row) => row.status)).toEqual([200, 200]);
    expect(await list()).toEqual([]);
  });
});
