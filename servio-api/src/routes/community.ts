// bulletin and pros routes
import { and, asc, desc, eq, inArray, isNull, ne, or, sql, type SQLWrapper } from 'drizzle-orm';
import { Hono } from 'hono';
import * as v from 'valibot';
import { cityProfile, haversineKm } from '../config/cities';
import { bulletinRequests, proProfiles, proSkus, reviews, serviceSkus, users } from '../db/schema';
import type { AppEnv } from '../env';
import { serverNow } from '../lib/bookings';
import { ApiError } from '../lib/errors';
import { ownedUpload, UPLOAD_KEY } from '../lib/uploads';
import { validate } from '../lib/validation';
import { requireUser } from '../middleware/auth';
import { withDb } from '../middleware/db';

export const community = new Hono<AppEnv>();
community.use('/bulletin/*', withDb, requireUser);
community.use('/pros', withDb, requireUser);
const text = (max: number) => v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(max));
const lat = v.pipe(v.number(), v.minValue(-90), v.maxValue(90));
const lng = v.pipe(v.number(), v.minValue(-180), v.maxValue(180));
const locationQuery = {
  lat: v.optional(v.pipe(v.string(), v.regex(/^-?\d+(?:\.\d+)?$/), v.transform(Number), v.minValue(-90), v.maxValue(90))),
  lng: v.optional(v.pipe(v.string(), v.regex(/^-?\d+(?:\.\d+)?$/), v.transform(Number), v.minValue(-180), v.maxValue(180))),
};
const paired = (i: { lat?: number; lng?: number }) => (i.lat === undefined) === (i.lng === undefined);
const distanceSql = (latitude: SQLWrapper, longitude: SQLWrapper, from: { lat: number; lng: number }) => sql`
  CASE WHEN ${latitude} IS NULL OR ${longitude} IS NULL THEN NULL ELSE
  6371 * acos(LEAST(1.0,GREATEST(-1.0,
    sin(radians(${latitude})) * sin(radians(${from.lat})) + cos(radians(${latitude})) * cos(radians(${from.lat})) * cos(radians(${longitude} - ${from.lng}))
  ))) END
`;

community.post('/bulletin', validate('json', v.pipe(v.strictObject({
  skuId: text(100), categoryId: text(100), description: text(200), neighborhood: text(150), urgent: v.optional(v.boolean(), false),
  lat: v.optional(lat), lng: v.optional(lng), photoKey: v.optional(v.pipe(v.string(), v.regex(UPLOAD_KEY))),
}), v.check((input) => paired(input), 'Provide both coordinates.'))), async (c) => {
  const input = c.req.valid('json');
  const [sku] = await c.get('db').select().from(serviceSkus).where(and(eq(serviceSkus.id, input.skuId), eq(serviceSkus.categoryId, input.categoryId), eq(serviceSkus.isActive, true)));
  if (!sku) throw new ApiError(422, 'SKU_UNAVAILABLE', 'Choose an available SKU in this category.');
  if (input.photoKey) await ownedUpload(c.get('db'), c.env, input.photoKey, c.get('userId'), 'request_photo');
  const [owner] = await c.get('db').select({ isDemo: users.isDemo }).from(users).where(eq(users.id, c.get('userId')));
  const [request] = await c.get('db').insert(bulletinRequests).values({ ...input, authorId: c.get('userId'), isDemo: owner!.isDemo, status: input.urgent ? 'URGENT' : 'OPEN' }).returning();
  return c.json({ request: { ...request, title: sku.name, priceCentavos: sku.priceCentavos, unit: sku.unit } }, 201);
});

community.get('/bulletin', validate('query', v.pipe(v.strictObject({ ...locationQuery,
  filter: v.optional(v.picklist(['all', 'open', 'urgent', 'nearby']), 'all'),
}), v.check((input) => paired(input), 'Provide both coordinates.'))), async (c) => {
  const input = c.req.valid('query');
  const origin = input.lat !== undefined ? { lat: input.lat, lng: input.lng! } : cityProfile(c.env.LAUNCH_CITY).center;
  const selection = { request: bulletinRequests, title: serviceSkus.name, priceCentavos: serviceSkus.priceCentavos, unit: serviceSkus.unit, author: users.fullName };
  const query = () => c.get('db').select(selection).from(bulletinRequests).innerJoin(serviceSkus, eq(serviceSkus.id, bulletinRequests.skuId)).innerJoin(users, eq(users.id, bulletinRequests.authorId));
  const rows = await query().where(and(ne(bulletinRequests.status,'COMPLETED'),or(ne(bulletinRequests.status,'CANCELLED'),eq(bulletinRequests.authorId,c.get('userId'))),input.filter === 'open' ? eq(bulletinRequests.status, 'OPEN') : input.filter === 'urgent' ? eq(bulletinRequests.status, 'URGENT') : undefined,
      input.filter === 'nearby' ? sql`${distanceSql(bulletinRequests.lat, bulletinRequests.lng, origin)} < 3` : undefined))
    .orderBy(desc(bulletinRequests.createdAt), desc(bulletinRequests.id)).limit(100);
  const viewer = c.get('userId');
  const pending = await query().where(and(or(eq(bulletinRequests.authorId, viewer), eq(bulletinRequests.acceptedProId, viewer)),eq(bulletinRequests.status,'ACCEPTED'),isNull(bulletinRequests.bookingId)));
  const owned = await query().where(and(eq(bulletinRequests.authorId,viewer),ne(bulletinRequests.status,'COMPLETED'))).orderBy(desc(bulletinRequests.createdAt)).limit(100);
  const combined = [...new Map([...rows,...pending,...owned].map(row=>[row.request.id,row])).values()];
  const requests = combined.map((r) => ({ ...r.request, bookingId: viewer === r.request.authorId || viewer === r.request.acceptedProId ? r.request.bookingId : null, title: r.title, priceCentavos: r.priceCentavos, unit: r.unit, author: r.author ?? 'Neighbor',
    distanceKm: input.lat !== undefined && r.request.lat != null && r.request.lng != null ? haversineKm(origin, { lat: r.request.lat, lng: r.request.lng }) : null,
  })).filter((r) => (r.status === 'ACCEPTED' && !r.bookingId && (r.authorId === viewer || r.acceptedProId === viewer)) || input.filter !== 'nearby' || (r.distanceKm !== null && r.distanceKm < 3));
  return c.json({ requests });
});

community.get('/pros', validate('query', v.pipe(v.strictObject({ ...locationQuery, id: v.optional(v.pipe(v.string(),v.uuid())), category: v.optional(text(100)) }), v.check((input) => paired(input), 'Provide both coordinates.'))), async (c) => {
  const input = c.req.valid('query');
  const origin = input.lat !== undefined ? { lat: input.lat, lng: input.lng! } : cityProfile(c.env.LAUNCH_CITY).center;
  const rows = await c.get('db').select({ id: users.id, name: users.fullName, avatarKey: users.avatarKey, profile: proProfiles })
    .from(users).innerJoin(proProfiles, eq(proProfiles.userId, users.id))
    .where(and(input.id ? eq(users.id,input.id) : undefined,eq(users.role, 'PRO'), eq(users.isActive, true), eq(proProfiles.kycStatus, 'APPROVED'),
      sql`EXISTS (SELECT 1 FROM pro_skus p JOIN service_skus s ON s.id=p.sku_id WHERE p.pro_id=${users.id} AND s.is_active=true ${input.category ? sql`AND s.category_id=${input.category}` : sql``})`))
    .orderBy(sql`CASE WHEN ${input.lat !== undefined} AND ${proProfiles.lastLocatedAt} BETWEEN NOW() - INTERVAL '15 minutes' AND NOW() THEN ${distanceSql(proProfiles.lastLat, proProfiles.lastLng, origin)} END ASC NULLS LAST`, desc(proProfiles.ratingAvg), asc(users.id)).limit(100);

  const proIds = rows.map((row) => row.id);
  const skusByPro = new Map<string, Array<typeof serviceSkus.$inferSelect>>();
  if (proIds.length > 0) {
    const skuRows = await c.get('db').select({ proId: proSkus.proId, sku: serviceSkus })
      .from(proSkus)
      .innerJoin(serviceSkus, eq(serviceSkus.id, proSkus.skuId))
      .where(and(inArray(proSkus.proId, proIds), eq(serviceSkus.isActive, true), input.category ? eq(serviceSkus.categoryId, input.category) : undefined));
    for (const row of skuRows) {
      const current = skusByPro.get(row.proId) ?? [];
      current.push(row.sku);
      skusByPro.set(row.proId, current);
    }
  }

  const reviewsByPro = new Map<string, Array<{ id: string; author: string | null; rating: number; body: string | null; createdAt: Date }>>();
  if (proIds.length > 0) {
    const reviewRows = await c.get('db').select({ proId: reviews.subjectId, id: reviews.id, author: users.fullName, rating: reviews.rating, body: reviews.body, createdAt: reviews.createdAt })
      .from(reviews)
      .innerJoin(users, eq(users.id, reviews.authorId))
      .where(inArray(reviews.subjectId, proIds))
      .orderBy(desc(reviews.createdAt));
    for (const row of reviewRows) {
      const current = reviewsByPro.get(row.proId) ?? [];
      current.push({ id: row.id, author: row.author, rating: row.rating, body: row.body, createdAt: row.createdAt });
      reviewsByPro.set(row.proId, current);
    }
  }

  const pros = [];
  for (const row of rows) {
    const skus = skusByPro.get(row.id) ?? [];
    if (!skus.length) continue;
    const feedback = (reviewsByPro.get(row.id) ?? []).slice(0, 10);
    const p = row.profile;
    pros.push({ id: row.id, name: row.name ?? 'SERVIO Pro', avatarKey: row.avatarKey, headline: p.headline, bio: p.bio, credentials: p.credentials,
      yearsExperience: p.yearsExperience, jobsDone: p.jobsDone, rating: Number(p.ratingAvg), ratingCount: p.ratingCount,
      isOnline: p.isOnline, distanceKm: input.lat !== undefined && p.lastLocatedAt && Date.now()-p.lastLocatedAt.getTime()>=0 && Date.now()-p.lastLocatedAt.getTime()<15*60000 && p.lastLat != null && p.lastLng != null ? haversineKm(origin, { lat: p.lastLat, lng: p.lastLng }) : null,
      fromPriceCentavos: Math.min(...skus.map((s) => s.priceCentavos)), skus, reviews: feedback });
  }
  pros.sort((a,b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || b.rating - a.rating);
  return c.json({ pros });
});

const bulletinId = v.strictObject({ id: v.pipe(v.string(), v.uuid()) });

community.get('/bulletin/:id', validate('param', bulletinId), async (c) => {
  const [request] = await c.get('db').select().from(bulletinRequests).where(eq(bulletinRequests.id, c.req.valid('param').id));
  if (!request) throw new ApiError(404, 'NOT_FOUND', 'Request not found.');
  const viewer = c.get('userId');
  return c.json({ request: { ...request, bookingId: viewer === request.authorId || viewer === request.acceptedProId ? request.bookingId : null } });
});

community.post('/bulletin/:id/accept', validate('param', bulletinId), validate('json', v.strictObject({})), async (c) => {
  const proId = c.get('userId');
  const request = await c.get('db').transaction(async (tx) => {
    await tx.select({id:users.id}).from(users).where(eq(users.id,proId)).for('no key update');
    const [row] = await tx.select().from(bulletinRequests).where(eq(bulletinRequests.id, c.req.valid('param').id)).for('update');
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Request not found.');
    if (row.authorId === proId) throw new ApiError(403, 'SELF_ACCEPT_NOT_ALLOWED', 'You cannot accept your own request.');
    const [qualified] = await tx.select({ id: users.id }).from(users)
      .innerJoin(proProfiles, eq(proProfiles.userId, users.id)).innerJoin(proSkus, eq(proSkus.proId, users.id))
      .innerJoin(serviceSkus, eq(serviceSkus.id, proSkus.skuId))
      .where(and(eq(users.id, proId), eq(users.role, 'PRO'), eq(users.isActive, true),
        eq(proProfiles.kycStatus, 'APPROVED'), eq(proSkus.skuId, row.skuId), eq(serviceSkus.isActive, true)));
    if (!qualified) throw new ApiError(403, 'QUALIFIED_PRO_REQUIRED', 'Switch to an approved Pro account offering this service before accepting.');
    if (row.status === 'ACCEPTED' && row.acceptedProId === proId && !row.bookingId) { c.set('liveHints', { replay: true }); return row; }
    if (!['OPEN', 'URGENT'].includes(row.status) || row.acceptedProId || row.bookingId) throw new ApiError(409, 'REQUEST_CLOSED', 'This request has already been accepted or closed.');
    const [changed] = await tx.update(bulletinRequests).set({ status: 'ACCEPTED', acceptedProId: proId, acceptedAt: await serverNow(tx) })
      .where(eq(bulletinRequests.id, row.id)).returning();
    return changed!;
  });
  return c.json({ request });
});

community.post('/bulletin/:id/release', validate('param', bulletinId), validate('json', v.strictObject({})), async (c) => {
  const request = await c.get('db').transaction(async (tx) => {
    const [row] = await tx.select().from(bulletinRequests).where(eq(bulletinRequests.id, c.req.valid('param').id)).for('update');
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Request not found.');
    if (row.authorId !== c.get('userId') && row.acceptedProId !== c.get('userId')) throw new ApiError(403, 'PARTICIPANT_REQUIRED', 'Only the customer or accepting Pro can release this request.');
    if (row.bookingId || row.status !== 'ACCEPTED') throw new ApiError(409, 'REQUEST_CLOSED', 'This request is no longer awaiting confirmation.');
    c.set('liveHints', { previousProId: row.acceptedProId });
    const [changed] = await tx.update(bulletinRequests).set({ status: row.urgent ? 'URGENT' : 'OPEN', acceptedProId: null, acceptedAt: null })
      .where(eq(bulletinRequests.id, row.id)).returning();
    return changed!;
  });
  return c.json({ request });
});

community.post('/bulletin/:id/cancel',validate('param',bulletinId),validate('json',v.strictObject({})),async(c)=>{
  const request=await c.get('db').transaction(async(tx)=>{
    const [row]=await tx.select().from(bulletinRequests).where(eq(bulletinRequests.id,c.req.valid('param').id)).for('update');
    if(!row)throw new ApiError(404,'NOT_FOUND','Request not found.');
    if(row.authorId!==c.get('userId'))throw new ApiError(403,'REQUEST_OWNER_REQUIRED','Only the author can cancel this request.');
    if(row.bookingId)throw new ApiError(409,'BOOKING_EXISTS','Open the booking to cancel it under the booking cancellation rules.');
    if(row.status==='CANCELLED'){c.set('liveHints',{replay:true});return row;}
    c.set('liveHints',{previousProId:row.acceptedProId});
    if(!['OPEN','URGENT','ACCEPTED'].includes(row.status))throw new ApiError(409,'REQUEST_CLOSED','This request is already closed.');
    const [changed]=await tx.update(bulletinRequests).set({status:'CANCELLED',acceptedProId:null,acceptedAt:null}).where(eq(bulletinRequests.id,row.id)).returning();return changed!;
  });return c.json({request});
});
