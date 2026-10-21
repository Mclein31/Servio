// wallet tests
import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ledgerEntries, payouts } from '../src/db/schema';
import { api, bookingFixture, hasDb, json } from './helpers';

describe.runIf(hasDb)('wallet and mock cashout (A8)', () => {
  let f: Awaited<ReturnType<typeof bookingFixture>>;
  beforeEach(async () => { f = await bookingFixture(); });
  afterEach(async () => { await f.close(); });
  const get = (query = '', headers: Record<string,string> = f.headers.pro) => api(`/wallet${query}`, { headers });
  const cashout = (body: unknown = { amountCentavos: 50000, gcashNumber: '09171234567' }, headers: Record<string,string> = f.headers.pro) => api('/wallet/cashout', json(body, headers));
  const complete = async () => {
    const { booking } = await (await api(`/bookings/${f.booking.id}`, { headers: f.headers.customer })).json() as { booking: { completionPin: string } };
    expect((await api(`/bookings/${f.booking.id}/verify-pin`, json({ pin: booking.completionPin }, f.headers.pro))).status).toBe(200);
  };
  const credit = async (amount: number, when = new Date()) => f.db.transaction(async (tx) => {
    const txnId = crypto.randomUUID();
    await tx.insert(ledgerEntries).values([
      { txnId, account: `customer:${f.customer.id}`, amountCentavos: -amount, kind: 'TEST', createdAt: when },
      { txnId, account: `pro_wallet:${f.pro.id}`, amountCentavos: amount, kind: 'TEST', createdAt: when },
    ]);
  });

  it('derives available/pending/today from ledger and open service escrow, excluding trust fees', async () => {
    const pending = await get(); expect(pending.status).toBe(200);
    expect(await pending.json()).toMatchObject({ availableCentavos: 0, pendingEscrowCentavos: 93500, todayNetCentavos: 0,
      ledger: [{ kind: 'PENDING_ESCROW', amountCentavos: 93500, bookingCode: f.booking.code }] });
    await complete();
    expect(await (await get()).json()).toMatchObject({ availableCentavos: 93500, pendingEscrowCentavos: 0, todayNetCentavos: 93500,
      ledger: [{ kind: 'ESCROW_RELEASE', amountCentavos: 93500 }] });
  });

  it('includes approved add-ons in pending earnings but never allows cashout from escrow', async () => {
    const quote = await (await api(`/bookings/${f.booking.id}/addons`, json({ addonSkuId: 'addon-drain-hose', photoKey: f.evidenceKey, note: 'Split drain hose' }, f.headers.pro))).json() as { quote: { id: string } };
    expect((await api(`/bookings/${f.booking.id}/addons/${quote.quote.id}/decision`, json({ approve: true }, f.headers.customer))).status).toBe(200);
    expect(await (await get()).json()).toMatchObject({ availableCentavos: 0, pendingEscrowCentavos: 123250 });
    expect((await cashout()).status).toBe(409);
  });

  it('debits amount + ₱15, balances all entries and stores only a masked paid mock destination', async () => {
    await complete();
    const res = await cashout(); expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ payout: { proId: f.pro.id, amountCentavos: 50000, feeCentavos: 1500, status: 'PAID', destinationMasked: '0917***4567' } });
    expect(await (await get()).json()).toMatchObject({ availableCentavos: 42000, pendingEscrowCentavos: 0, todayNetCentavos: 93500 });
    const entries = await f.db.select().from(ledgerEntries).where(eq(ledgerEntries.account, `pro_wallet:${f.pro.id}`));
    const payout = entries.find((e) => e.kind === 'PAYOUT')!;
    expect(payout.amountCentavos).toBe(-51500);
    const txn = await f.db.select().from(ledgerEntries).where(eq(ledgerEntries.txnId, payout.txnId));
    expect(txn.reduce((n,e) => n + e.amountCentavos,0)).toBe(0);
    expect(txn).toHaveLength(3);
    expect(JSON.stringify(txn)).not.toContain('09171234567');
  });

  it('serializes concurrent cashouts so two cannot overdraw the same balance', async () => {
    await complete();
    const responses = await Promise.all([cashout(), cashout()]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await (await get()).json()).toMatchObject({ availableCentavos: 42000 });
    expect(await f.db.select().from(payouts).where(eq(payouts.proId, f.pro.id))).toHaveLength(1);
  });

  it('rejects insufficient balance including the fee without writing a payout', async () => {
    await credit(50000);
    expect((await cashout()).status).toBe(409);
    expect(await f.db.select().from(payouts).where(eq(payouts.proId, f.pro.id))).toHaveLength(0);
    expect(await (await get()).json()).toMatchObject({ availableCentavos: 50000 });
  });

  it('requires a Pro session and validates centavos, minimum and GCash destination', async () => {
    expect((await get('', {})).status).toBe(401);
    expect((await get('', f.headers.customer)).status).toBe(403);
    expect((await cashout(undefined, {})).status).toBe(401);
    expect((await cashout(undefined, f.headers.customer)).status).toBe(403);
    for (const patch of [{ amountCentavos: 49999 }, { amountCentavos: 50000.5 }, { amountCentavos: 2147483647 }, { gcashNumber: '+639171234567' }, { gcashNumber: '1234' }, { feeCentavos: 0 }]) {
      expect((await cashout({ amountCentavos: 50000, gcashNumber: '09171234567', ...patch })).status).toBe(422);
    }
    expect((await get('?limit=0')).status).toBe(422);
    expect((await get('?cursor=invalid')).status).toBe(422);
  });

  it('paginates mixed pending/posted entries with stable microsecond cursors', async () => {
    await credit(10000); await credit(20000); await credit(30000);
    let cursor: string | null = null; const ids: string[] = [];
    do {
      const res = await get(`?limit=1${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      expect(res.status).toBe(200);
      const result = await res.json() as { ledger: { id: string }[]; nextCursor: string | null };
      ids.push(...result.ledger.map((e) => e.id)); cursor = result.nextCursor;
    } while (cursor);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
  });

  it('uses Philippine midnight for today earnings', async () => {
    const result = await f.db.execute<{ boundary: string }>(sql`SELECT (extract(epoch FROM (date_trunc('day', clock_timestamp() AT TIME ZONE INTERVAL '+08:00') AT TIME ZONE INTERVAL '+08:00')) * 1000)::text AS boundary`);
    const boundary = Number(result.rows[0]!.boundary);
    await credit(10000, new Date(boundary - 1000));
    await credit(20000, new Date(boundary + 1000));
    expect(await (await get()).json()).toMatchObject({ availableCentavos: 30000, todayNetCentavos: 20000 });
  });
});
