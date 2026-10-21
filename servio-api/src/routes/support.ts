// support routes
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import * as v from 'valibot';
import type { AppEnv } from '../env';
import { supportRequests, users } from '../db/schema';
import { ApiError } from '../lib/errors';
import { participantBooking } from '../lib/bookings';
import { validate } from '../lib/validation';
import { requireUser } from '../middleware/auth';
import { withDb } from '../middleware/db';

export const support = new Hono<AppEnv>();
support.use('/support/*',withDb,requireUser);
support.get('/support/requests',async(c)=>{
  const requests=await c.get('db').select().from(supportRequests).where(eq(supportRequests.userId,c.get('userId'))).orderBy(desc(supportRequests.createdAt)).limit(50);
  return c.json({requests});
});
support.post('/support/requests',validate('json',v.strictObject({
  clientKey:v.pipe(v.string(),v.uuid()),
  category:v.picklist(['BOOKING','PAYMENT','SAFETY','ACCOUNT','OTHER']),
  message:v.pipe(v.string(),v.trim(),v.minLength(10),v.maxLength(2000)),
  bookingId:v.optional(v.pipe(v.string(),v.uuid())),
})),async(c)=>{
  const input=c.req.valid('json'); const db=c.get('db'); const userId=c.get('userId');
  if(input.bookingId) await participantBooking(db,input.bookingId,userId);
  const result=await db.transaction(async(tx)=>{
    const [created]=await tx.insert(supportRequests).values({...input,userId}).onConflictDoNothing().returning();
    if(created) return created;
    const [existing]=await tx.select().from(supportRequests).where(and(eq(supportRequests.userId,userId),eq(supportRequests.clientKey,input.clientKey)));
    if(!existing || existing.message!==input.message || existing.category!==input.category || existing.bookingId!==(input.bookingId??null)) {
      throw new ApiError(409,'IDEMPOTENCY_CONFLICT','This submission key was used for another report.');
    }
    return existing;
  });
  return c.json({request:result},201);
});
support.use('/support/admin/*',async(c,next)=>{
  const [actor]=await c.get('db').select({role:users.role}).from(users).where(eq(users.id,c.get('userId')));
  if(actor?.role!=='ADMIN') throw new ApiError(403,'ADMIN_REQUIRED','Only SERVIO staff can review reports.');
  await next();
});
support.get('/support/admin/requests',async(c)=>{
  const requests=await c.get('db').select().from(supportRequests).orderBy(desc(supportRequests.createdAt)).limit(100);
  return c.json({requests});
});
support.post('/support/admin/requests/:id',validate('param',v.strictObject({id:v.pipe(v.string(),v.uuid())})),validate('json',v.strictObject({status:v.picklist(['OPEN','REVIEWING','RESOLVED'])})),async(c)=>{
  const [request]=await c.get('db').update(supportRequests).set({status:c.req.valid('json').status,updatedAt:new Date()}).where(eq(supportRequests.id,c.req.valid('param').id)).returning();
  if(!request) throw new ApiError(404,'NOT_FOUND','Report not found.');
  return c.json({request});
});
