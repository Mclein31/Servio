import { TestBed } from '@angular/core/testing';
import { Geolocation } from '@capacitor/geolocation';
import { vi } from 'vitest';
import { DISCOVERY_GEOLOCATION, DiscoveryLocationService } from './discovery-location.service';
const geolocation={checkPermissions:vi.fn(),getCurrentPosition:vi.fn()};
describe('discovery location measurements',()=>{
 beforeEach(()=>{vi.resetAllMocks();vi.useFakeTimers();TestBed.configureTestingModule({providers:[{provide:DISCOVERY_GEOLOCATION,useValue:geolocation}]});});afterEach(()=>{TestBed.resetTestingModule();vi.useRealTimers();});
 it('does not prompt or invent an origin when permission is denied',async()=>{
  geolocation.checkPermissions.mockResolvedValue({location:'denied',coarseLocation:'denied'});
  const service=TestBed.inject(DiscoveryLocationService);await service.refreshGranted();expect(service.query()).toEqual({});expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
 });
 it('uses measured coordinates and expires them instead of retaining an old distance',async()=>{
  geolocation.getCurrentPosition.mockResolvedValue({coords:{latitude:17.61,longitude:121.72},timestamp:Date.now()} as Awaited<ReturnType<typeof Geolocation.getCurrentPosition>>);
  const service=TestBed.inject(DiscoveryLocationService);expect(await service.locate()).toBe(true);expect(service.query()).toEqual({lat:17.61,lng:121.72});
  vi.advanceTimersByTime(120001);expect(service.point()).toBeNull();expect(service.query()).toEqual({});
 });
 it('clears a failed fix and reports an actionable error',async()=>{
  geolocation.getCurrentPosition.mockRejectedValue(new Error('Permission denied'));
  const service=TestBed.inject(DiscoveryLocationService);expect(await service.locate()).toBe(false);expect(service.query()).toEqual({});expect(service.error()).toContain('Enable location');
 });
});
