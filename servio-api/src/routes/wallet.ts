import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import * as v from 'valibot';
import { ledgerEntries, payouts } from '../db/schema';
import type { AppEnv } from '../env';
import { ApiError } from '../lib/errors';
import { validate } from '../lib/validation';
import { requireUser } from '../middleware/auth';
import { withDb } from '../middleware/db';
import { requirePro } from '../middleware/pro';

export const MIN_CASHOUT_CENTAVOS = 50000;
export const CASHOUT_FEE_CENTAVOS = 1500;
export const wallet = new Hono<AppEnv>();
wallet.use('/wallet/*', withDb, requireUser, requirePro);

const List = v.strictObject({
  cursor: v.optional(v.pipe(v.string(), v.maxLength(500))),
  limit: v.optional(v.pipe(v.string(), v.regex(/^\d{1,3}$/), v.transform(Number), v.minValue(1), v.maxValue(100)), '20'),
});
const Cursor = v.strictObject({ at: v.pipe(v.string(), v.isoTimestamp()), id: v.pipe(v.string(), v.regex(/^(escrow:)?[0-9a-f-]{36}$/)) });

wallet.get('/wallet', validate('query', List), async (c) => {
  return c.get('db').transaction(async (db) => {
    const proId = c.get('userId'); const account = `pro_wallet:${proId}`;
    const { limit, cursor } = c.req.valid('query');
    let after: v.InferOutput<typeof Cursor> | undefined;
    if (cursor) {
      try { after = v.parse(Cursor, JSON.parse(atob(cursor))); }
      catch { throw new ApiError(422, 'VALIDATION_FAILED', 'Invalid wallet cursor.'); }
    }
    const balances = await db.execute<{ available: string; today: string }>(sql`
      SELECT COALESCE(SUM(amount_centavos),0)::text AS available,
        COALESCE(SUM(amount_centavos) FILTER (WHERE amount_centavos > 0 AND created_at >=
          (date_trunc('day', clock_timestamp() AT TIME ZONE INTERVAL '+08:00') AT TIME ZONE INTERVAL '+08:00')),0)::text AS today
      FROM ledger_entries WHERE account = ${account}
    `);
    const open = sql`SELECT b.id, b.created_at, b.code, b.sku_name,
      floor(((b.price_centavos::bigint + COALESCE((SELECT SUM(a.price_centavos) FROM addon_quotes a WHERE a.booking_id=b.id AND a.decision='APPROVED'),0))*8500+5000)/10000)::integer AS amount
      FROM bookings b WHERE b.pro_id=${proId} AND b.escrow='HOLD_AUTHORIZED' AND b.status NOT IN ('COMPLETED','CANCELLED')`;
    const pending = await db.execute<{ total: string }>(sql`SELECT COALESCE(SUM(amount),0)::text AS total FROM (${open}) pending`);
    type Entry = { id: string; createdAt: string; amountCentavos: number; kind: string; title: string; bookingCode: string | null; memo: string | null }
    const result = await db.execute<Entry>(sql`
      WITH entries AS (
        SELECT l.id::text AS id, l.created_at, l.amount_centavos AS amount, l.kind,
          COALESCE(b.sku_name, l.memo, 'Wallet transaction') AS title, b.code, l.memo
        FROM ledger_entries l LEFT JOIN bookings b ON b.id=l.booking_id WHERE l.account=${account}
        UNION ALL
        SELECT 'escrow:' || p.id::text AS id, p.created_at, p.amount, 'PENDING_ESCROW' AS kind, p.sku_name, p.code, 'In escrow' AS memo FROM (${open}) p
      )
      SELECT id, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt", amount AS "amountCentavos", kind, title, code AS "bookingCode", memo
      FROM entries ${after ? sql`WHERE (created_at,id) < (${after.at}::timestamptz, ${after.id})` : sql``}
      ORDER BY created_at DESC, id DESC LIMIT ${limit + 1}
    `);
    const entries = result.rows.slice(0, limit); const last = entries[entries.length - 1];
    return c.json({ availableCentavos: Number(balances.rows[0]!.available), pendingEscrowCentavos: Number(pending.rows[0]!.total),
      todayNetCentavos: Number(balances.rows[0]!.today), ledger: entries,
      nextCursor: result.rows.length > limit && last ? btoa(JSON.stringify({ at: last.createdAt, id: last.id })) : null });
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
});

wallet.post('/wallet/cashout', validate('json', v.strictObject({
  amountCentavos: v.pipe(v.number(), v.integer(), v.minValue(MIN_CASHOUT_CENTAVOS), v.maxValue(2_147_483_647 - CASHOUT_FEE_CENTAVOS)),
  gcashNumber: v.pipe(v.string(), v.regex(/^09\d{9}$/)),
})), async (c) => {
  const { amountCentavos, gcashNumber } = c.req.valid('json');
  const proId = c.get('userId');
  const payout = await c.get('db').transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`wallet:${proId}`},0))`);
    const balance = await tx.execute<{ amount: string }>(sql`SELECT COALESCE(SUM(amount_centavos),0)::text AS amount FROM ledger_entries WHERE account=${`pro_wallet:${proId}`}`);
    const total = amountCentavos + CASHOUT_FEE_CENTAVOS;
    if (Number(balance.rows[0]!.amount) < total) throw new ApiError(409, 'INSUFFICIENT_BALANCE', 'Amount plus the ₱15 fee exceeds your balance.');
    const destinationMasked = `${gcashNumber.slice(0, 4)}***${gcashNumber.slice(-4)}`;
    const txnId = crypto.randomUUID();
    await tx.insert(ledgerEntries).values([
      { txnId, account: `pro_wallet:${proId}`, amountCentavos: -total, kind: 'PAYOUT', memo: `Cashout to GCash ${destinationMasked}` },
      { txnId, account: 'payout_clearing', amountCentavos, kind: 'PAYOUT', memo: `GCash ${destinationMasked}` },
      { txnId, account: 'platform_revenue', amountCentavos: CASHOUT_FEE_CENTAVOS, kind: 'PAYOUT', memo: 'Cashout fee' },
    ]);
    const [row] = await tx.insert(payouts).values({ proId, amountCentavos, feeCentavos: CASHOUT_FEE_CENTAVOS, destinationMasked, status: 'REQUESTED' }).returning();
    const [paid] = await tx.update(payouts).set({ status: 'PAID' }).where(eq(payouts.id, row!.id)).returning();
    return paid!;
  });
  return c.json({ payout }, 201);
});
