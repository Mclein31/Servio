// orders tests
import { describe, expect, it } from 'vitest';
import { isActiveOrderStatus, selectActiveBooking } from './order.service';

describe('active tracking status', () => {
  it.each(['PENDING_ACCEPTANCE', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'] as const)(
    'shows tracking for %s bookings',
    (status) => expect(isActiveOrderStatus(status)).toBe(true),
  );

  it.each(['COMPLETED', 'CANCELLED'] as const)(
    'hides tracking for %s bookings',
    (status) => expect(isActiveOrderStatus(status)).toBe(false),
  );

  it('does not replace a completed current booking with an unrelated active booking', () => {
    const completed = { id: 'completed', status: 'COMPLETED' as const };
    const active = { id: 'other', status: 'IN_PROGRESS' as const };
    expect(selectActiveBooking([active, completed], 'completed')).toBeUndefined();
  });

  it('selects the newest active booking when there is no current booking', () => {
    const active = { id: 'active', status: 'ACCEPTED' as const };
    const completed = { id: 'completed', status: 'COMPLETED' as const };
    expect(selectActiveBooking([completed, active], '')).toBe(active);
  });
});
