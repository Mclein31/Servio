import { afterEach,beforeEach,describe,expect,it } from 'vitest';
import { eq } from 'drizzle-orm';
import { supportRequests,users } from '../src/db/schema';
import { api,bookingFixture,hasDb,json } from './helpers';
describe.runIf(hasDb)('account payment preferences and support reports',()=>{
  let f:Awaited<ReturnType<typeof bookingFixture>>;
  beforeEach(async()=>{f=await bookingFixture();});afterEach(async()=>{await f.close();});
  it('persists allowed payment methods per owner and rejects credentials',async()=>{
    expect((await api('/me/payment-methods',json({preferred:'CARD'},f.headers.customer))).status).toBe(200);
    expect(await(await api('/me/payment-methods',{headers:f.headers.customer})).json()).toMatchObject({preferred:'CARD',simulated:true});
    expect(await(await api('/me/payment-methods',{headers:f.headers.pro})).json()).toMatchObject({preferred:'GCASH'});
    expect((await api('/me/payment-methods',json({preferred:'CARD',cardNumber:'4111111111111111'},f.headers.customer))).status).toBe(422);
    expect((await api('/me/payment-methods',json({preferred:'CASH'},f.headers.customer))).status).toBe(422);
    expect((await api('/me/payment-methods')).status).toBe(401);
  });
  it('deduplicates reports, enforces ownership, and allows staff review',async()=>{
    const input={clientKey:crypto.randomUUID(),category:'BOOKING',message:'The booked service was not completed.',bookingId:f.booking.id};
    const responses=await Promise.all([api('/support/requests',json(input,f.headers.customer)),api('/support/requests',json(input,f.headers.customer))]);
    expect(responses.map(r=>r.status)).toEqual([201,201]);
    const {request}=await responses[0]!.json() as {request:{id:string}};
    expect((await api('/support/requests',json({...input,message:'A different report content'},f.headers.customer))).status).toBe(409);
    expect((await api('/support/requests',json({...input,clientKey:crypto.randomUUID()},f.headers.other))).status).toBe(404);
    expect(await(await api('/support/requests',{headers:f.headers.other})).json()).toMatchObject({requests:[]});
    expect((await api('/support/admin/requests',{headers:f.headers.customer})).status).toBe(403);
    await f.db.update(users).set({role:'ADMIN'}).where(eq(users.id,f.other.id));
    expect((await api('/support/admin/requests',{headers:f.headers.other})).status).toBe(200);
    expect((await api(`/support/admin/requests/${request.id}`,json({status:'REVIEWING'},f.headers.other))).status).toBe(200);
    const rows=await f.db.select().from(supportRequests).where(eq(supportRequests.userId,f.customer.id));
    expect(rows).toHaveLength(1);expect(rows[0]!.status).toBe('REVIEWING');
  });
  it('rejects unauthenticated and invalid report submissions',async()=>{
    const input={clientKey:crypto.randomUUID(),category:'SAFETY',message:'Report this safety concern.'};
    expect((await api('/support/requests',json(input))).status).toBe(401);
    for(const patch of [{message:'short'},{message:'x'.repeat(2001)},{category:'UNKNOWN'},{status:'RESOLVED'}]){
      expect((await api('/support/requests',json({...input,...patch},f.headers.customer))).status).toBe(422);
    }
  });
});
