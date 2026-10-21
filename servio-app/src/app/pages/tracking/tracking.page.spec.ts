// tracking page tests
import { describe, expect, it } from 'vitest';
import { canShowProviderTracking } from './tracking.page';

describe('customer provider-tracking visibility', () => {
  it('shows an active booking to its customer', () => {
    expect(canShowProviderTracking('CUSTOMER', 'customer-1', 'customer-1', true, false)).toBe(true);
  });

  it('hides provider tracking from the Pro account', () => {
    expect(canShowProviderTracking('PRO', 'customer-1', 'pro-1', true, false)).toBe(false);
  });

  it('hides a different customer’s booking', () => {
    expect(canShowProviderTracking('CUSTOMER', 'customer-1', 'customer-2', true, false)).toBe(false);
  });

  it('hides completed and cancelled bookings from the tracking card', () => {
    expect(canShowProviderTracking('CUSTOMER', 'customer-1', 'customer-1', false, false)).toBe(false);
  });

  it('keeps the mock customer demo tracking available', () => {
    expect(canShowProviderTracking('CUSTOMER', undefined, 'mock-customer', true, true)).toBe(true);
  });
});
