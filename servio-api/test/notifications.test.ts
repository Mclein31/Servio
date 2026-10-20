import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { api, bookingFixture, hasDb, json } from './helpers';

type Inbox = { notifications: { id: string; kind: string; title: string; route: string | null; bookingId: string | null; readAt: string | null }[]; unreadCount: number };
const inbox = async (headers: Record<string, string>) => {
  const result = await api('/notifications', { headers }); expect(result.status).toBe(200);
  return result.json() as Promise<Inbox>;
};

describe.runIf(hasDb)('notification inbox', () => {
  let f: Awaited<ReturnType<typeof bookingFixture>>;
  beforeEach(async () => { f = await bookingFixture('EN_ROUTE'); });
  afterEach(async () => { await f.close(); });

  it('records the other participant’s notifications, owner-scoped, and marks them read', async () => {
    expect((await api(`/bookings/${f.booking.id}/messages`, json({ body: 'Nasa gate na po ako' }, f.headers.pro))).status).toBe(201);
    expect((await api(`/bookings/${f.booking.id}/status`, json({ to: 'ARRIVED' }, f.headers.pro))).status).toBe(200);
    const customer = await inbox(f.headers.customer);
    expect(customer.unreadCount).toBe(2);
    expect(customer.notifications.map((n) => n.kind)).toEqual(['BOOKING', 'MESSAGE']);
    expect(customer.notifications[1]).toMatchObject({ route: `/order/${f.booking.id}/chat`, bookingId: f.booking.id });
    expect((await inbox(f.headers.pro)).notifications.map((n) => n.title)).toEqual([expect.stringMatching(/^New booking/)]);
    expect((await inbox(f.headers.other)).notifications).toHaveLength(0);

    const ids = customer.notifications.map((n) => n.id);
    expect(await (await api('/notifications/read', json({ ids }, f.headers.other))).json()).toEqual({ unreadCount: 0 });
    expect((await inbox(f.headers.customer)).unreadCount).toBe(2);

    const read = await api('/notifications/read', json({ bookingId: f.booking.id, kind: 'MESSAGE' }, f.headers.customer));
    expect(await read.json()).toEqual({ unreadCount: 1 });
    expect(await (await api('/notifications/read', json({ all: true }, f.headers.customer))).json()).toEqual({ unreadCount: 0 });
    expect((await api('/notifications/read', json({ all: true, ids }, f.headers.customer))).status).toBe(422);
    expect((await api('/notifications')).status).toBe(401);
  });
});
