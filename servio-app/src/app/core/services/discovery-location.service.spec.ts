// discovery location tests
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { DiscoveryLocationService } from './discovery-location.service';
import { AddressService } from './address.service';

describe('saved address discovery origin', () => {
  const selected = signal<{lat:number;lng:number}|null>(null);
  const refresh = vi.fn();
  beforeEach(() => {
    selected.set(null);vi.resetAllMocks();
    TestBed.configureTestingModule({ providers: [{ provide: AddressService, useValue: { selected, refresh } }] });
  });
  afterEach(() => TestBed.resetTestingModule());
  it('leaves distances unavailable without a saved address', () => {
    expect(TestBed.inject(DiscoveryLocationService).query()).toEqual({});
  });
  it('immediately uses the updated selected pin and never expires it like a GPS fix', async () => {
    const service = TestBed.inject(DiscoveryLocationService);
    selected.set({lat:17.61,lng:121.72});
    expect(service.query()).toEqual({lat:17.61,lng:121.72});
    selected.set({lat:17.8,lng:121.9});
    expect(service.query()).toEqual({lat:17.8,lng:121.9});
    await service.refresh();expect(refresh).toHaveBeenCalledOnce();
  });
  it('rejects invalid saved coordinates', () => {
    selected.set({lat:NaN,lng:121.72});
    expect(TestBed.inject(DiscoveryLocationService).query()).toEqual({});
  });
});
