import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TUGUEGARAO_ROUTE } from '../data/tuguegarao-route';
import { DEMO_ADDRESS } from '../data/launch-city';
import { RouteTrack } from '../../shared/utils/route-track';
import { OrderService } from './order.service';
import { TrackingSimService } from './tracking-sim.service';

const route = new RouteTrack(TUGUEGARAO_ROUTE, 'geo');

describe('Tuguegarao demo tracking', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('embeds a 1.5–2 km route in Tuguegarao with a residential Ugac Norte destination', () => {
    expect(route.total).toBeGreaterThan(1500);
    expect(route.total).toBeLessThan(2000);
    for (const [lat, lng] of TUGUEGARAO_ROUTE) {
      expect(lat).toBeGreaterThan(17.60);
      expect(lat).toBeLessThan(17.63);
      expect(lng).toBeGreaterThan(121.71);
      expect(lng).toBeLessThan(121.74);
    }
    expect(route.sample(route.total).point).toEqual([17.618111, 121.718927]);
  });

  it('advances the rider along the new geometry while en route', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const orders = { order: signal({ status: 'EN_ROUTE' }), setStatus: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: OrderService, useValue: orders }] });
    const sim = TestBed.inject(TrackingSimService);
    TestBed.tick();
    const initial = sim.displayDistance();
    const firstPosition = sim.sample(initial).point;
    vi.advanceTimersByTime(10_000);
    expect(sim.running()).toBe(true);
    expect(sim.displayDistance()).toBeGreaterThan(initial);
    expect(sim.sample(sim.displayDistance()).point).not.toEqual(firstPosition);
    expect(sim.remainingM()).toBeLessThan(1400);
    expect(sim.destination).toEqual(TUGUEGARAO_ROUTE[TUGUEGARAO_ROUTE.length - 1]);
  });

  it('moves a cached order address to the launch city without resetting its financial state', () => {
    localStorage.removeItem('servio.demo.order');
    const seeded = TestBed.inject(OrderService).order();
    TestBed.resetTestingModule();
    localStorage.setItem('servio.demo.order', JSON.stringify({ ...seeded, status: 'IN_PROGRESS', address: { ...seeded.address, city: 'Previous demo city' } }));
    const migrated = TestBed.inject(OrderService).order();
    expect(migrated.address).toEqual(DEMO_ADDRESS);
    expect(migrated.status).toBe('IN_PROGRESS');
    expect(migrated.sku).toEqual(seeded.sku);
    expect(migrated.trustFeePhp).toBe(seeded.trustFeePhp);
    expect(migrated.addons).toEqual(seeded.addons);
  });
});
