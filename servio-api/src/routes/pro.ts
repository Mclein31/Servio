// pro routes
import { and, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import * as v from 'valibot';
import type { AppEnv } from '../env';
import { bookings, bookingEvents, dispatchOffers, messages, proProfiles, users } from '../db/schema';
import { advanceDispatch, dispatchTick, emptyDispatch } from '../dispatch/demo-dispatch';
import { serverNow } from '../lib/bookings';
import { ApiError } from '../lib/errors';
import { validate } from '../lib/validation';
import { requireUser } from '../middleware/auth';
import { withDb } from '../middleware/db';
import { requirePro } from '../middleware/pro';

export const pro = new Hono<AppEnv>();
pro.use('/pro/*', withDb, requireUser, requirePro);
pro.use('/offers/*', withDb, requireUser, requirePro);

pro.post('/pro/availability', validate('json', v.pipe(v.strictObject({ online: v.boolean(),
  lat: v.optional(v.pipe(v.number(), v.minValue(-90), v.maxValue(90))), lng: v.optional(v.pipe(v.number(), v.minValue(-180), v.maxValue(180))),
}), v.check((i) => (i.lat === undefined) === (i.lng === undefined), 'Provide both coordinates.'))), async (c) => {
  const profile = await c.get('db').transaction(async (tx) => {
    const [row] = await tx.select().from(proProfiles).where(eq(proProfiles.userId, c.get('userId'))).for('update');
    const input = c.req.valid('json');
    if (input.online && row!.kycStatus !== 'APPROVED') throw new ApiError(403, 'KYC_REQUIRED', 'Only approved Pros may go online.');
    const [changed] = await tx.update(proProfiles).set({ isOnline: input.online,
      ...(input.lat !== undefined ? { lastLat: input.lat, lastLng: input.lng, lastLocatedAt: await serverNow(tx) } : {}),
    }).where(eq(proProfiles.userId, c.get('userId'))).returning();
    return changed!;
  });
  return c.json({ pro: profile });
});

pro.post('/pro/location', validate('json',v.strictObject({
  lat:v.pipe(v.number(),v.minValue(-90),v.maxValue(90)),lng:v.pipe(v.number(),v.minValue(-180),v.maxValue(180)),
})),async(c)=>{
  const [profile]=await c.get('db').update(proProfiles).set({ lastLat:c.req.valid('json').lat,lastLng:c.req.valid('json').lng,lastLocatedAt:await serverNow(c.get('db')) })
    .where(and(eq(proProfiles.userId,c.get('userId')),eq(proProfiles.kycStatus,'APPROVED'),eq(proProfiles.isOnline,true))).returning();
  if(!profile) throw new ApiError(409,'PRO_OFFLINE','Go online before refreshing your dispatch location.');
  return c.json({ updated:true });
});

pro.post('/pro/dispatch', validate('json', v.strictObject({})), async (c) => {
  const [actor] = await c.get('db').select({ isDemo: users.isDemo }).from(users).where(eq(users.id, c.get('userId')));
  c.set('liveHints', { dispatch: await dispatchTick(c.get('db'), c.env.LAUNCH_CITY, actor!.isDemo) });
  const now = await serverNow(c.get('db'));
  const rows = await c.get('db').select({ offer: dispatchOffers,
    booking: { id: bookings.id, code: bookings.code, skuName: bookings.skuName, priceCentavos: bookings.priceCentavos, trustFeeCentavos: bookings.trustFeeCentavos,
      barangay: sql<string>`${bookings.address}->>'barangay'`, city: sql<string>`${bookings.address}->>'city'` },
  }).from(dispatchOffers).innerJoin(bookings, eq(bookings.id, dispatchOffers.bookingId))
    .where(and(eq(dispatchOffers.proId, c.get('userId')), eq(dispatchOffers.response, 'PENDING'), eq(bookings.status, 'PENDING_ACCEPTANCE'), sql`${dispatchOffers.expiresAt} > ${now}`))
    .orderBy(desc(dispatchOffers.createdAt)).limit(1);
  return c.json({ offer: rows[0] ? { ...rows[0].offer, booking: rows[0].booking } : null, serverNow: now.toISOString() });
});

pro.post('/offers/:id/:action', validate('param', v.strictObject({ id: v.pipe(v.string(), v.uuid()), action: v.picklist(['accept','decline']) })), validate('json', v.strictObject({})), async (c) => {
  const { id, action } = c.req.valid('param'); const proId = c.get('userId');
  const dispatch = emptyDispatch(); c.set('liveHints', { dispatch });
  const result = await c.get('db').transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`dispatch-pro:${proId}`},0))`);
    const [lookup] = await tx.select().from(dispatchOffers).where(and(eq(dispatchOffers.id, id), eq(dispatchOffers.proId, proId)));
    if (!lookup) throw new ApiError(404, 'NOT_FOUND', 'Offer not found.');
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, lookup.bookingId)).for('update');
    const [offer] = await tx.select().from(dispatchOffers).where(eq(dispatchOffers.id, id)).for('update');
    const now = await serverNow(tx);
    if (booking!.status !== 'PENDING_ACCEPTANCE' || offer!.response !== 'PENDING') throw new ApiError(409, 'OFFER_CLOSED', 'This offer is no longer available.');
    if (offer!.expiresAt <= now) { await advanceDispatch(tx, booking!, c.env.LAUNCH_CITY, dispatch); return null; }
    if (action === 'accept') {
      if (booking!.customerId === proId) throw new ApiError(403, 'SELF_BOOKING_NOT_ALLOWED', 'You cannot accept your own booking.');
      const [profile] = await tx.select().from(proProfiles).where(eq(proProfiles.userId, proId));
      if (profile!.kycStatus !== 'APPROVED' || !profile!.isOnline) throw new ApiError(403, 'PRO_UNAVAILABLE', 'Go online as an approved Pro before accepting.');
      await tx.update(dispatchOffers).set({ response: 'ACCEPTED', respondedAt: now }).where(eq(dispatchOffers.id, id));
      await tx.update(bookings).set({ proId, status: 'ACCEPTED' }).where(eq(bookings.id, booking!.id));
      await tx.insert(bookingEvents).values({ bookingId: booking!.id, status: 'ACCEPTED', actorId: proId, createdAt: now });
      await tx.insert(messages).values({ bookingId: booking!.id, body: 'Your Pro accepted the booking.', createdAt: now });
    } else {
      await tx.update(dispatchOffers).set({ response: 'DECLINED', respondedAt: now }).where(eq(dispatchOffers.id, id));
      await advanceDispatch(tx, booking!, c.env.LAUNCH_CITY, dispatch);
    }
    return { bookingId: booking!.id };
  });
  if (!result) throw new ApiError(409, 'OFFER_EXPIRED', 'This offer expired.');
  return c.json(result);
});
