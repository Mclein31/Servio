// completion pin tests
import { env } from 'cloudflare:test';
import { and, eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src/index';
import { bookingEvents, bookings, ledgerEntries, proProfiles } from '../src/db/schema';
import { completionPin } from '../src/lib/completion-pin';
import { mockPayments } from '../src/payments/mock';
import { api, bookingFixture, hasDb, json } from './helpers';

it('derives the first four decimal HMAC digits from a known independent vector', async () => {
  expect(await completionPin('AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=', '11111111-1111-4111-8111-111111111111')).toBe('6774');
  await expect(completionPin('', crypto.randomUUID())).rejects.toThrow('unavailable');
});

describe.runIf(hasDb)('completion PIN and escrow release (A7)', () => {
  let f: Awaited<ReturnType<typeof bookingFixture>>;
  beforeEach(async () => { f = await bookingFixture(); });
  afterEach(async () => { vi.restoreAllMocks(); await f.close(); });
  const pin = async () => (await (await api(`/bookings/${f.booking.id}`, { headers: f.headers.customer })).json() as { booking: { completionPin: string } }).booking.completionPin;
  const verify = (value: unknown, headers: Record<string,string> = f.headers.pro) => api(`/bookings/${f.booking.id}/verify-pin`, json({ pin: value }, headers));
  const net = async (account: string) => Number((await f.db.execute<{ n: string }>(sql`SELECT COALESCE(SUM(amount_centavos),0)::text AS n FROM ledger_entries WHERE account = ${account}`)).rows[0]!.n);

  it('completes ₱1,100 + ₱350 with Pro 123250, platform 26750 and empty escrow, once', async () => {
    const quote = await (await api(`/bookings/${f.booking.id}/addons`, json({ addonSkuId: 'addon-drain-hose', photoKey: f.evidenceKey, note: 'Replace damaged hose' }, f.headers.pro))).json() as { quote: { id: string } };
    expect((await api(`/bookings/${f.booking.id}/addons/${quote.quote.id}/decision`, json({ approve: true }, f.headers.customer))).status).toBe(200);
    await f.db.update(bookings).set({ status: 'IN_PROGRESS' }).where(eq(bookings.id, f.booking.id));
    const code = await pin(); expect(code).toMatch(/^\d{4}$/);
    const res = await verify(code); expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ booking: { status: 'COMPLETED', escrow: 'COMPLETED', totalCentavos: 150000 } });
    expect(await net(`pro_wallet:${f.pro.id}`)).toBe(123250);
    expect(await net(`escrow:${f.booking.id}`)).toBe(0);
    const release = await f.db.select().from(ledgerEntries).where(and(eq(ledgerEntries.bookingId, f.booking.id), eq(ledgerEntries.kind, 'ESCROW_RELEASE')));
    expect(release).toHaveLength(3);
    expect(release.find((e) => e.account === 'platform_revenue')!.amountCentavos).toBe(26750);
    expect(new Set(release.map((e) => e.txnId)).size).toBe(1);
    expect(release.reduce((n,e) => n + e.amountCentavos, 0)).toBe(0);
    const [profile] = await f.db.select().from(proProfiles).where(eq(proProfiles.userId, f.pro.id));
    expect(profile!.jobsDone).toBe(1);
    expect((await verify(code)).status).toBe(409);
    expect(await net(`pro_wallet:${f.pro.id}`)).toBe(123250);
    expect(await f.db.select().from(bookingEvents).where(and(eq(bookingEvents.bookingId, f.booking.id), eq(bookingEvents.status, 'COMPLETED')))).toHaveLength(1);
  });

  it('shows the PIN only to the customer and verifies only for the assigned Pro', async () => {
    const customer = await (await api(`/bookings/${f.booking.id}`, { headers: f.headers.customer })).json();
    expect(customer).toMatchObject({ booking: { completionPin: expect.stringMatching(/^\d{4}$/) } });
    const pro = await (await api(`/bookings/${f.booking.id}`, { headers: f.headers.pro })).json() as { booking: object };
    expect(pro.booking).not.toHaveProperty('completionPin');
    const list = await (await api('/bookings?role=pro', { headers: f.headers.pro })).json() as { bookings: object[] };
    expect(list.bookings[0]).not.toHaveProperty('completionPin');
    expect((await verify(await pin(), {})).status).toBe(401);
    expect((await verify(await pin(), f.headers.customer)).status).toBe(403);
    expect((await verify(await pin(), f.headers.other)).status).toBe(404);
    expect(await net(`pro_wallet:${f.pro.id}`)).toBe(0);
  });

  it('persists five wrong attempts then locks even the correct PIN without releasing money', async () => {
    const right = await pin(); const wrong = right === '0000' ? '1111' : '0000';
    for (let i = 1; i <= 5; i++) expect((await verify(wrong)).status).toBe(i === 5 ? 423 : 422);
    expect((await verify(right)).status).toBe(423);
    const [stored] = await f.db.select().from(bookings).where(eq(bookings.id, f.booking.id));
    expect(stored!.pinAttempts).toBe(5);
    expect(stored!.status).toBe('ARRIVED');
    expect(await net(`escrow:${f.booking.id}`)).toBe(115000);
    expect(await net(`pro_wallet:${f.pro.id}`)).toBe(0);
  });

  it('rejects malformed input or wrong lifecycle without consuming attempts', async () => {
    for (const invalid of ['123', '12345', 'abcd', 1234]) expect((await verify(invalid)).status).toBe(422);
    await f.db.update(bookings).set({ status: 'EN_ROUTE' }).where(eq(bookings.id, f.booking.id));
    expect((await verify(await pin())).status).toBe(409);
    const [stored] = await f.db.select().from(bookings).where(eq(bookings.id, f.booking.id));
    expect(stored!.pinAttempts).toBe(0);
  });

  it('serializes concurrent valid PINs and releases only once', async () => {
    const code = await pin();
    const responses = await Promise.all([verify(code), verify(code)]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await net(`pro_wallet:${f.pro.id}`)).toBe(93500);
    expect(await net(`escrow:${f.booking.id}`)).toBe(0);
  });

  it('rolls back capture failure, and fails closed when the secret is missing', async () => {
    const code = await pin();
    vi.spyOn(mockPayments, 'capture').mockRejectedValueOnce(new Error('Capture failed'));
    expect((await verify(code)).status).toBe(500);
    expect(await net(`escrow:${f.booking.id}`)).toBe(115000);
    expect(await net(`pro_wallet:${f.pro.id}`)).toBe(0);
    const missing = await app.request(`http://servio.test/api/v1/bookings/${f.booking.id}/verify-pin`, json({ pin: code }, f.headers.pro), { ...env, PIN_SECRET: undefined });
    expect(missing.status).toBe(503);
    expect((await verify(code)).status).toBe(200);
  });
});
