// demo order reset
import { eq, sql } from 'drizzle-orm';
import type { Database } from '../db/client';
import { addonQuotes, bookingEvents, bookings, ledgerEntries, messages, proProfiles, reviews, users } from '../db/schema';
import { cityProfile } from '../config/cities';
import { serverNow } from '../lib/bookings';
import { ApiError } from '../lib/errors';
import { DEMO } from './guard';

export async function resetDemoOrder(db: Database, userId: string, city?: string) {
  return db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, DEMO.active)).for('update');
    if (!booking?.isDemo || booking.customerId !== DEMO.customer || booking.proId !== DEMO.daniel || ![booking.customerId,booking.proId].includes(userId)) throw new ApiError(404,'NOT_FOUND','Demo order not found.');
    const participants = await tx.select().from(users).where(sql`${users.id} IN (${booking.customerId},${booking.proId})`);
    if (participants.length !== 2 || participants.some((p) => !p.isDemo || !p.isActive)) throw new ApiError(404,'NOT_FOUND','Demo order not found.');
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`wallet:${booking.proId}`},0))`);
    const net = await tx.execute<{ account: string; amount: string }>(sql`SELECT account,SUM(amount_centavos)::text AS amount FROM ledger_entries WHERE booking_id=${booking.id} GROUP BY account HAVING SUM(amount_centavos) <> 0`);
    for (const row of net.rows.filter((r) => r.account.startsWith('pro_wallet:') && Number(r.amount)>0)) {
      const balance = await tx.execute<{ amount: string }>(sql`SELECT COALESCE(SUM(amount_centavos),0)::text AS amount FROM ledger_entries WHERE account=${row.account}`);
      if (Number(balance.rows[0]!.amount) < Number(row.amount)) throw new ApiError(409,'FULL_RESET_REQUIRED','Those earnings have already been cashed out. Use the guarded full demo reset.');
    }
    const txnId = crypto.randomUUID();
    const total = booking.priceCentavos+booking.trustFeeCentavos;
    const rows = [...net.rows.map((r) => ({ account:r.account, amountCentavos:-Number(r.amount) })),
      { account:`customer:${booking.customerId}`,amountCentavos:-(total-booking.discountCentavos) },{ account:`escrow:${booking.id}`,amountCentavos:total },
      ...(booking.discountCentavos ? [{ account:'platform_promotions',amountCentavos:-booking.discountCentavos }] : [])];
    if (rows.some((r) => !Number.isSafeInteger(r.amountCentavos) || Math.abs(r.amountCentavos)>2147483647)) throw new ApiError(409,'FULL_RESET_REQUIRED','Use the guarded full demo reset.');
    await tx.insert(ledgerEntries).values(rows.map((r) => ({ ...r,txnId,bookingId:booking.id,kind:'DEMO_RESET',memo:'Order reset' })));
    const [review] = await tx.select().from(reviews).where(eq(reviews.bookingId,booking.id));
    if (review) {
      await tx.update(proProfiles).set({ ratingSum:sql`${proProfiles.ratingSum}-${review.rating}`,ratingCount:sql`${proProfiles.ratingCount}-1`,
        ratingAvg:sql`CASE WHEN ${proProfiles.ratingCount}>1 THEN round((${proProfiles.ratingSum}-${review.rating})::numeric/(${proProfiles.ratingCount}-1),2) ELSE 0 END` }).where(eq(proProfiles.userId,booking.proId));
      await tx.delete(reviews).where(eq(reviews.bookingId,booking.id));
    }
    if (booking.status === 'COMPLETED') await tx.update(proProfiles).set({ jobsDone:sql`${proProfiles.jobsDone}-1` }).where(eq(proProfiles.userId,booking.proId));
    await tx.delete(addonQuotes).where(eq(addonQuotes.bookingId,booking.id));
    const clock = await serverNow(tx);
    const previous=await tx.execute<{ ms:string|null }>(sql`SELECT floor(extract(epoch FROM MAX(created_at))*1000)::text AS ms FROM booking_events WHERE booking_id=${booking.id}`);
    const now=new Date(Math.max(clock.getTime(),Number(previous.rows[0]?.ms ?? 0)+1));
    const profile=cityProfile(city);
    const expectedArrivalAt = new Date(now.getTime()+profile.defaultTravelMinutes*60000);
    await tx.update(bookings).set({ status:'EN_ROUTE',escrow:'HOLD_AUTHORIZED',pinAttempts:0,tipCentavos:0,expectedArrivalAt,
      noShowDeadlineAt:new Date(expectedArrivalAt.getTime()+profile.noShowGraceMinutes*60000),createdAt:now }).where(eq(bookings.id,booking.id));
    for (const [index,status] of (['PENDING_ACCEPTANCE','ACCEPTED','EN_ROUTE'] as const).entries()) await tx.insert(bookingEvents).values({ bookingId:booking.id,status,actorId:userId,note:status==='PENDING_ACCEPTANCE'?'DEMO_RESET: presentation restarted.':null,createdAt:new Date(now.getTime()+index) });
    await tx.insert(messages).values({ bookingId:booking.id,body:'Order reset. Your Pro is on the way.',createdAt:await serverNow(tx) });
    return booking.id;
  });
}
