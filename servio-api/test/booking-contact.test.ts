// booking contact tests
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bookings, users } from '../src/db/schema';
import { api, bookingFixture, hasDb } from './helpers';

describe.runIf(hasDb)('private booking contact', () => {
  let f: Awaited<ReturnType<typeof bookingFixture>>;
  beforeEach(async () => { f = await bookingFixture('ACCEPTED'); });
  afterEach(async () => { await f.close(); });
  const contact = (headers: Record<string, string>) => api(`/bookings/${f.booking.id}/contact`, { headers });
  it('returns only the other participant number and forbids outsiders', async () => {
    await f.db.update(users).set({ phoneNumber: '+639171234567' }).where(eq(users.id, f.customer.id));
    await f.db.update(users).set({ phoneNumber: '+639181234567' }).where(eq(users.id, f.pro.id));
    const customer = await contact(f.headers.customer);
    expect(customer.headers.get('Cache-Control')).toBe('no-store');
    expect(await customer.json()).toEqual({ phoneNumber: '+639181234567' });
    expect(await (await contact(f.headers.pro)).json()).toEqual({ phoneNumber: '+639171234567' });
    expect((await contact(f.headers.other)).status).toBe(404);
    expect((await contact({})).status).toBe(401);
  });
  it('returns null for missing numbers and denies ended or unassigned bookings', async () => {
    expect(await (await contact(f.headers.customer)).json()).toEqual({ phoneNumber: null });
    for (const status of ['COMPLETED', 'CANCELLED', 'PENDING_ACCEPTANCE'] as const) {
      await f.db.update(bookings).set({ status }).where(eq(bookings.id, f.booking.id));
      expect((await contact(f.headers.customer)).status).toBe(409);
    }
    await f.db.update(bookings).set({ status: 'ACCEPTED', proId: null }).where(eq(bookings.id, f.booking.id));
    expect((await contact(f.headers.customer)).status).toBe(409);
  });
});
