import { and, asc, eq, or, sql } from 'drizzle-orm';
import type { Executor } from '../db/client';
import { addonQuotes, bookingEvents, bookings as bookingTable } from '../db/schema';
import { ApiError } from './errors';
import { completionPin } from './completion-pin';

function publicBooking(row: typeof bookingTable.$inferSelect, addons: (typeof addonQuotes.$inferSelect)[] = []) {
  const { idempotencyKey: _key, requestHash: _hash, pinAttempts: _attempts, ...booking } = row;
  return { ...booking, totalCentavos: row.priceCentavos + row.trustFeeCentavos + addons.filter((a) => a.decision === 'APPROVED').reduce((n, a) => n + a.priceCentavos, 0) };
}

export async function serverNow(db: Executor): Promise<Date> {
  const result = await db.execute<{ nowMs: string }>(sql`SELECT (extract(epoch FROM clock_timestamp()) * 1000)::text AS "nowMs"`);
  return new Date(Number(result.rows[0]!.nowMs));
}

/** Authorization is part of the query; an unrelated user cannot probe whether a booking exists. */
export async function participantBooking(db: Executor, id: string, userId: string, lock = false) {
  const query = db.select().from(bookingTable).where(and(eq(bookingTable.id, id), or(eq(bookingTable.customerId, userId), eq(bookingTable.proId, userId))));
  const [row] = lock ? await query.for('update') : await query;
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Booking not found.');
  return row;
}

export async function bookingDetails(db: Executor, row: typeof bookingTable.$inferSelect, userId?: string, secret?: string) {
  const events = await db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, row.id)).orderBy(asc(bookingEvents.createdAt), asc(bookingEvents.id));
  const addons = await db.select().from(addonQuotes).where(eq(addonQuotes.bookingId, row.id)).orderBy(asc(addonQuotes.createdAt), asc(addonQuotes.id));
  return { ...publicBooking(row, addons), events, addons, ...(userId === row.customerId ? { completionPin: await completionPin(secret, row.id) } : {}) };
}

