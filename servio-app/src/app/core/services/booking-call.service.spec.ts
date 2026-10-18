import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AlertController } from '@ionic/angular';
import { vi } from 'vitest';
import { ApiService } from '../api/api.service';
import { BookingCallService, PHONE_DIALER } from './booking-call.service';

describe('booking calls', () => {
  const api = { settings: { useMockApi: signal(false) }, get: vi.fn() };
  const dial = vi.fn(); const present = vi.fn(); const create = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks(); api.settings.useMockApi.set(false); create.mockResolvedValue({ present });
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }, { provide: AlertController, useValue: { create } }, { provide: PHONE_DIALER, useValue: dial }] });
  });
  afterEach(() => TestBed.resetTestingModule());
  it('requests the authorized peer and opens their telephone number', async () => {
    api.get.mockResolvedValue({ phoneNumber: '+639171234567' });
    await TestBed.inject(BookingCallService).call('booking-id');
    expect(api.get).toHaveBeenCalledWith('/bookings/booking-id/contact');
    expect(dial).toHaveBeenCalledWith('tel:+639171234567'); expect(create).not.toHaveBeenCalled();
  });
  it('shows the requested message for missing numbers and never invents demo numbers', async () => {
    api.get.mockResolvedValue({ phoneNumber: null }); const service = TestBed.inject(BookingCallService);
    await service.call('booking-id');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ message: 'Call not available. User did not add his number' }));
    api.get.mockClear(); api.settings.useMockApi.set(true); await service.call('demo');
    expect(api.get).not.toHaveBeenCalled(); expect(dial).not.toHaveBeenCalled();
  });
  it('rejects unsafe numbers and distinguishes connection errors from missing numbers', async () => {
    api.get.mockResolvedValue({ phoneNumber: '123;evil' }); const service = TestBed.inject(BookingCallService);
    await service.call('booking-id'); expect(dial).not.toHaveBeenCalled();
    api.get.mockRejectedValue(new Error('offline')); await service.call('booking-id');
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ message: 'Could not connect the call. Please try again.' }));
  });
  it('prevents repeated taps from starting duplicate calls', async () => {
    let resolve!: (value: { phoneNumber: string }) => void;
    api.get.mockReturnValue(new Promise((done) => resolve = done));
    const service = TestBed.inject(BookingCallService); const first = service.call('one'); await service.call('one');
    resolve({ phoneNumber: '+639171234567' }); await first;
    expect(api.get).toHaveBeenCalledTimes(1); expect(dial).toHaveBeenCalledTimes(1);
  });
});
