import { describe, expect, it } from 'vitest';
import { bookingNotices, bulletinNotices, type BookingInfo } from '../src/live/notices';

const b = (status: string, proId: string | null = 'pro'): BookingInfo => ({ id: 'b1', code: 'SRV-1', skuName: 'AC Repair', status, customerId: 'cust', proId });

describe('notification rules', () => {
  it('tells the customer about Pro progress but never the acting Pro', () => {
    expect(bookingNotices(b('EN_ROUTE'), { kind: 'status' }, 'pro')).toMatchObject([{ userId: 'cust', title: 'Your Pro is on the way', route: '/tabs/tracking' }]);
    expect(bookingNotices(b('COMPLETED'), { kind: 'status' }, 'pro')).toMatchObject([{ userId: 'cust', route: '/order/b1/review' }]);
  });
  it('tells the other participant about a cancellation', () => {
    expect(bookingNotices(b('CANCELLED'), { kind: 'status' }, 'cust').map((n) => n.userId)).toEqual(['pro']);
    expect(bookingNotices(b('CANCELLED'), { kind: 'status' }, 'pro').map((n) => n.userId)).toEqual(['cust']);
    expect(bookingNotices(b('CANCELLED', null), { kind: 'status' }, 'other-pro').map((n) => n.userId)).toEqual(['cust']);
  });
  it('routes messages to the recipient chat with a clipped preview', () => {
    const [n] = bookingNotices(b('EN_ROUTE'), { kind: 'message', body: 'x'.repeat(300), photo: false }, 'cust');
    expect(n).toMatchObject({ userId: 'pro', kind: 'MESSAGE', route: '/order/b1/chat' });
    expect(n!.body.length).toBe(120);
    expect(bookingNotices(b('EN_ROUTE'), { kind: 'message', body: '', photo: true }, 'pro')[0]).toMatchObject({ userId: 'cust', body: 'Sent a photo.' });
  });
  it('announces offers, direct bookings, add-ons and reviews to the right side', () => {
    expect(bookingNotices(b('PENDING_ACCEPTANCE', null), { kind: 'offer', proId: 'p9' }, 'p2')).toMatchObject([{ userId: 'p9', kind: 'OFFER' }]);
    expect(bookingNotices(b('ACCEPTED'), { kind: 'created' }, 'cust')).toMatchObject([{ userId: 'pro', route: '/pro/order/b1/execute' }]);
    expect(bookingNotices(b('PENDING_ACCEPTANCE', null), { kind: 'created' }, 'cust')).toEqual([]);
    expect(bookingNotices(b('ARRIVED'), { kind: 'addon-quote' }, 'pro')).toMatchObject([{ userId: 'cust', route: '/order/b1/addon-modal' }]);
    expect(bookingNotices(b('ARRIVED'), { kind: 'addon-decision', approved: false }, 'cust')).toMatchObject([{ userId: 'pro', title: 'Add-on declined' }]);
    expect(bookingNotices(b('COMPLETED'), { kind: 'review', rating: 5 }, 'cust')).toMatchObject([{ userId: 'pro', kind: 'REVIEW' }]);
  });
  it('tells the other side about bulletin reservations', () => {
    const request = { id: 'r1', authorId: 'cust', acceptedProId: 'pro' };
    expect(bulletinNotices(request, 'accept', 'pro').map((n) => n.userId)).toEqual(['cust']);
    expect(bulletinNotices({ ...request, acceptedProId: null }, 'release', 'cust', 'pro').map((n) => n.userId)).toEqual(['pro']);
    expect(bulletinNotices({ ...request, acceptedProId: null }, 'release', 'pro', 'pro').map((n) => n.userId)).toEqual(['cust']);
    expect(bulletinNotices({ ...request, acceptedProId: null }, 'cancel', 'cust', 'pro').map((n) => n.userId)).toEqual(['pro']);
  });
});
