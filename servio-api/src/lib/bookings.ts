import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import type { Executor } from '../db/client';
import { addonQuotes, bookingEvents, bookings as bookingTable, users, proProfiles, reviews } from '../db/schema';
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

export async function participantBooking(db: Executor, id: string, userId: string, lock = false) {
  const query = db.select().from(bookingTable).where(and(eq(bookingTable.id, id), or(eq(bookingTable.customerId, userId), eq(bookingTable.proId, userId))));
  const [row] = lock ? await query.for('update') : await query;
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Booking not found.');
  return row;
}

export async function bookingDetails(db: Executor, row: typeof bookingTable.$inferSelect, userId?: string, secret?: string) {
  const events = await db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, row.id)).orderBy(asc(bookingEvents.createdAt), asc(bookingEvents.id));
  const addons = await db.select().from(addonQuotes).where(eq(addonQuotes.bookingId, row.id)).orderBy(asc(addonQuotes.createdAt), asc(addonQuotes.id));
  const [customer] = await db.select({ id: users.id, name: users.fullName, avatarKey: users.avatarKey }).from(users).where(eq(users.id, row.customerId));
  const [pro] = row.proId ? await db.select({ id: users.id, name: users.fullName, avatarKey: users.avatarKey, rating: proProfiles.ratingAvg, ratingCount: proProfiles.ratingCount })
    .from(users).innerJoin(proProfiles, eq(proProfiles.userId, users.id)).where(eq(users.id, row.proId)) : [];
  const [review] = await db.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.bookingId, row.id), eq(reviews.authorId, row.customerId)));
  return { ...publicBooking(row, addons), events, addons, customer, pro: pro ? { ...pro, rating: Number(pro.rating) } : null, reviewed: !!review, ...(userId === row.customerId ? { completionPin: await completionPin(secret, row.id) } : {}) };
}

export async function bookingDetailsMany(db: Executor, rows: (typeof bookingTable.$inferSelect)[], userId?: string, secret?: string) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const peopleIds = [...new Set(rows.flatMap((r) => [r.customerId, ...(r.proId ? [r.proId] : [])]))];
  const [events, addons, people, pros, reviewed] = await Promise.all([
    db.select().from(bookingEvents).where(inArray(bookingEvents.bookingId, ids)).orderBy(asc(bookingEvents.createdAt), asc(bookingEvents.id)),
    db.select().from(addonQuotes).where(inArray(addonQuotes.bookingId, ids)).orderBy(asc(addonQuotes.createdAt), asc(addonQuotes.id)),
    db.select({ id: users.id, name: users.fullName, avatarKey: users.avatarKey }).from(users).where(inArray(users.id, peopleIds)),
    db.select({ id: proProfiles.userId, rating: proProfiles.ratingAvg, ratingCount: proProfiles.ratingCount }).from(proProfiles).where(inArray(proProfiles.userId, peopleIds)),
    db.select({ bookingId: reviews.bookingId, authorId: reviews.authorId }).from(reviews).where(inArray(reviews.bookingId, ids)),
  ]);
  const person = new Map(people.map((p) => [p.id, p]));
  const pro = new Map(pros.map((p) => [p.id, p]));
  return Promise.all(rows.map(async (row) => {
    const own = addons.filter((a) => a.bookingId === row.id);
    const proPerson = row.proId ? person.get(row.proId) : undefined;
    const proStats = row.proId ? pro.get(row.proId) : undefined;
    return { ...publicBooking(row, own), events: events.filter((e) => e.bookingId === row.id), addons: own, customer: person.get(row.customerId),
      pro: proPerson && proStats ? { ...proPerson, rating: Number(proStats.rating), ratingCount: proStats.ratingCount } : null,
      reviewed: reviewed.some((r) => r.bookingId === row.id && r.authorId === row.customerId),
      ...(userId === row.customerId ? { completionPin: await completionPin(secret, row.id) } : {}) };
  }));
}
