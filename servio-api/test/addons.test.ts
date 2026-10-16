import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addonQuotes, bookings, ledgerEntries } from '../src/db/schema';
import { splitPayout } from '../src/lib/money';
import { mockPayments } from '../src/payments/mock';
import { api, bookingFixture, hasDb, json } from './helpers';

describe.runIf(hasDb)('catalog add-on quotes (A5)', () => {
  let f: Awaited<ReturnType<typeof bookingFixture>>;
  const input = () => ({ addonSkuId: 'addon-drain-hose', photoKey: f.evidenceKey, note: 'The drain hose is split; this catalog replacement includes installation.' });
  const quote = (body: unknown = input(), headers: Record<string, string> = f.headers.pro) => api(`/bookings/${f.booking.id}/addons`, json(body, headers));
  const decide = (id: string, approve: boolean, headers: Record<string, string> = f.headers.customer) => api(`/bookings/${f.booking.id}/addons/${id}/decision`, json({ approve }, headers));
  const escrow = async () => Number((await f.db.execute<{ n: string }>(sql`SELECT sum(amount_centavos)::text AS n FROM ledger_entries WHERE account = ${`escrow:${f.booking.id}`}`)).rows[0]!.n);
  beforeEach(async () => { f = await bookingFixture(); });
  afterEach(async () => { vi.restoreAllMocks(); await f.close(); });

  it('snapshots ₱350 and holds it only on customer approval, with no early Pro credit', async () => {
    const res = await quote(); expect(res.status).toBe(201);
    const created = await res.json() as { quote: typeof addonQuotes.$inferSelect };
    expect(created.quote).toMatchObject({ addonSkuId: 'addon-drain-hose', priceCentavos: 35000, decision: 'PENDING', createdBy: f.pro.id });
    expect(await escrow()).toBe(115000);
    const approved = await decide(created.quote.id, true);
    expect(approved.status).toBe(200);
    expect(await approved.json()).toMatchObject({ quote: { decision: 'APPROVED' } });
    expect(await escrow()).toBe(150000);
    expect(splitPayout(created.quote.priceCentavos).proCentavos).toBe(29750);
    const entries = await f.db.select().from(ledgerEntries).where(eq(ledgerEntries.bookingId, f.booking.id));
    expect(entries).toHaveLength(4);
    const addon = entries.filter((e) => e.kind === 'ADDON_HOLD');
    expect(addon.reduce((n, e) => n + e.amountCentavos, 0)).toBe(0);
    expect(addon[0]!.txnId).toBe(addon[1]!.txnId);
    expect(entries.some((e) => e.account.startsWith('pro_wallet:'))).toBe(false);
    const detail = await (await api(`/bookings/${f.booking.id}`, { headers: f.headers.customer })).json();
    expect(detail).toMatchObject({ booking: { totalCentavos: 150000, addons: [{ decision: 'APPROVED' }] } });
    expect((await decide(created.quote.id, true)).status).toBe(409);
    expect(await escrow()).toBe(150000);
  });

  it('declines without moving money and permits the next catalog quote', async () => {
    const created = await (await quote()).json() as { quote: { id: string } };
    expect((await decide(created.quote.id, false)).status).toBe(200);
    expect(await escrow()).toBe(115000);
    expect((await decide(created.quote.id, true)).status).toBe(409);
    expect((await quote()).status).toBe(201);
  });

  it('serializes concurrent quotes and concurrent approvals', async () => {
    const responses = await Promise.all([quote(), quote()]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    const created = await responses.find((r) => r.status === 201)!.json() as { quote: { id: string } };
    const decisions = await Promise.all([decide(created.quote.id, true), decide(created.quote.id, true)]);
    expect(decisions.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await escrow()).toBe(150000);
  });

  it('requires auth and the assigned Pro for quotes, and the customer for decisions', async () => {
    expect((await quote(input(), {})).status).toBe(401);
    expect((await quote(input(), f.headers.customer)).status).toBe(403);
    expect((await quote(input(), f.headers.other)).status).toBe(404);
    const created = await (await quote()).json() as { quote: { id: string } };
    expect((await decide(created.quote.id, true, {})).status).toBe(401);
    expect((await decide(created.quote.id, true, f.headers.pro)).status).toBe(403);
    expect((await decide(created.quote.id, true, f.headers.other)).status).toBe(404);
    expect((await decide(crypto.randomUUID(), true)).status).toBe(404);
  });

  it.each(['ACCEPTED', 'EN_ROUTE', 'COMPLETED', 'CANCELLED'] as const)('blocks quotes and decisions in %s', async (status) => {
    const created = await (await quote()).json() as { quote: { id: string } };
    await f.db.update(bookings).set({ status }).where(eq(bookings.id, f.booking.id));
    expect((await quote()).status).toBe(409);
    expect((await decide(created.quote.id, true)).status).toBe(409);
    expect(await escrow()).toBe(115000);
  });

  it.each([{ priceCentavos: 1 }, { addonSkuId: 'unknown' }, { photoKey: '../private.jpg' }, { photoKey: `uploads/addon_evidence/2026/10/${'-'.repeat(36)}.jpg` }, { photoKey: 'uploads/kyc/2026/10/fake.pdf' }, { note: '' }])('validates catalog-only pricing and evidence: %j', async (patch) => {
    expect((await quote({ ...input(), ...patch })).status).toBe(422);
    expect(await escrow()).toBe(115000);
  });

  it('rolls back a failed authorization without deciding the quote or adding money', async () => {
    const created = await (await quote()).json() as { quote: { id: string } };
    vi.spyOn(mockPayments, 'authorizeHold').mockRejectedValueOnce(new Error('Mock failure'));
    expect((await decide(created.quote.id, true)).status).toBe(500);
    const [stored] = await f.db.select().from(addonQuotes).where(eq(addonQuotes.id, created.quote.id));
    expect(stored!.decision).toBe('PENDING');
    expect(await escrow()).toBe(115000);
    expect((await decide(created.quote.id, true)).status).toBe(200);
  });
});
