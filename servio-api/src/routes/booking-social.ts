import { and, asc, eq, sql } from 'drizzle-orm';
import type { Hono } from 'hono';
import * as v from 'valibot';
import { bookings, ledgerEntries, messages, proProfiles, reviews, uploads } from '../db/schema';
import type { AppEnv } from '../env';
import { participantBooking, serverNow } from '../lib/bookings';
import { ApiError } from '../lib/errors';
import { ownedUpload, UPLOAD_KEY } from '../lib/uploads';
import { validate } from '../lib/validation';
import { mockPayments } from '../payments/mock';

const id = v.pipe(v.string(), v.uuid());
const params = v.strictObject({ id });
const text = (max: number) => v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(max));

export function registerBookingSocial(router: Hono<AppEnv>) {
  router.post('/bookings/:id/review', validate('param', params), validate('json', v.strictObject({
    rating: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(5)),
    compliments: v.pipe(v.array(text(50)), v.maxLength(10)), body: v.optional(text(2000)),
    tipCentavos: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(2_147_483_647)),
  })), async (c) => {
    const review = await c.get('db').transaction(async (tx) => {
      const booking = await participantBooking(tx, c.req.valid('param').id, c.get('userId'), true);
      if (booking.customerId !== c.get('userId')) throw new ApiError(403, 'CUSTOMER_REQUIRED', 'Only the customer may review this booking.');
      if (booking.status !== 'COMPLETED' || !booking.proId) throw new ApiError(409, 'BOOKING_INCOMPLETE', 'Complete the booking before reviewing it.');
      const [existing] = await tx.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.bookingId, booking.id), eq(reviews.authorId, c.get('userId'))));
      if (existing) throw new ApiError(409, 'ALREADY_REVIEWED', 'This booking has already been reviewed.');
      const input = c.req.valid('json');
      if (input.tipCentavos) {
        const payment = { bookingId: booking.id, customerId: booking.customerId, amountCentavos: input.tipCentavos, paymentMethod: booking.paymentMethod };
        await mockPayments.authorizeHold(payment); await mockPayments.capture(payment);
        const txnId = crypto.randomUUID();
        await tx.insert(ledgerEntries).values([
          { txnId, bookingId: booking.id, account: `customer:${booking.customerId}`, amountCentavos: -input.tipCentavos, kind: 'TIP' },
          { txnId, bookingId: booking.id, account: `pro_wallet:${booking.proId}`, amountCentavos: input.tipCentavos, kind: 'TIP' },
        ]);
      }
      const [row] = await tx.insert(reviews).values({ bookingId: booking.id, authorId: booking.customerId, subjectId: booking.proId,
        rating: input.rating, compliments: input.compliments, body: input.body, createdAt: await serverNow(tx) }).returning();
      await tx.update(proProfiles).set({
        ratingSum: sql`${proProfiles.ratingSum} + ${input.rating}`, ratingCount: sql`${proProfiles.ratingCount} + 1`,
        ratingAvg: sql`round((${proProfiles.ratingSum} + ${input.rating})::numeric / (${proProfiles.ratingCount} + 1),2)`,
      }).where(eq(proProfiles.userId, booking.proId));
      await tx.update(bookings).set({ tipCentavos: input.tipCentavos }).where(eq(bookings.id, booking.id));
      return row!;
    });
    return c.json({ review }, 201);
  });

  router.get('/bookings/:id/messages', validate('param', params), validate('query', v.strictObject({
    after: v.optional(id), limit: v.optional(v.pipe(v.string(), v.regex(/^\d{1,3}$/), v.transform(Number), v.minValue(1), v.maxValue(100)), '100'),
  })), async (c) => {
    const booking = await participantBooking(c.get('db'), c.req.valid('param').id, c.get('userId'));
    const { after, limit } = c.req.valid('query');
    if (after) {
      const [cursor] = await c.get('db').select({ id: messages.id }).from(messages).where(and(eq(messages.id, after), eq(messages.bookingId, booking.id)));
      if (!cursor) throw new ApiError(422, 'VALIDATION_FAILED', 'Invalid message cursor.');
    }
    const rows = await c.get('db').select().from(messages).where(and(eq(messages.bookingId, booking.id),
      after ? sql`(${messages.createdAt},${messages.id}) > (SELECT created_at,id FROM messages WHERE id=${after})` : undefined,
    )).orderBy(asc(messages.createdAt), asc(messages.id)).limit(limit + 1);
    return c.json({ messages: rows.slice(0, limit), nextCursor: rows.length > limit ? rows[limit - 1]!.id : null });
  });

  router.post('/bookings/:id/messages', validate('param', params), validate('json', v.pipe(v.strictObject({
    body: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(2000)), ''), photoKey: v.optional(v.pipe(v.string(), v.regex(UPLOAD_KEY))),
  }), v.check((i) => !!i.body || !!i.photoKey, 'Write a message or attach a photo.'))), async (c) => {
    const message = await c.get('db').transaction(async (tx) => {
      const booking = await participantBooking(tx, c.req.valid('param').id, c.get('userId'), true);
      if (['COMPLETED', 'CANCELLED'].includes(booking.status)) throw new ApiError(409, 'CHAT_CLOSED', 'This booking is closed.');
      const input = c.req.valid('json');
      if (input.photoKey) {
        const [file] = await tx.select().from(uploads).where(and(eq(uploads.key, input.photoKey), eq(uploads.ownerId, c.get('userId'))));
        if (!file || !['request_photo', 'addon_evidence'].includes(file.purpose)) throw new ApiError(404, 'FILE_NOT_FOUND', 'File not found.');
        await ownedUpload(tx, c.env, input.photoKey, c.get('userId'), file.purpose);
      }
      const [row] = await tx.insert(messages).values({ ...input, bookingId: booking.id, senderId: c.get('userId'), createdAt: await serverNow(tx) }).returning();
      return row!;
    });
    return c.json({ message }, 201);
  });
}
