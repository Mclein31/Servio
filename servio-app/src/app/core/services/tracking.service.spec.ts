// tracking tests
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Geolocation } from '@capacitor/geolocation';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { ApiService } from '../api/api.service';
import { AuthService } from './auth.service';
import { OrderService } from './order.service';
import { LiveFix, LiveService } from './live.service';
import { TrackingService } from './tracking.service';
import { TUGUEGARAO_ROUTE } from '../data/tuguegarao-route';

vi.mock('@capacitor/geolocation',()=>({ Geolocation:{ watchPosition:vi.fn().mockResolvedValue('watch-1'),clearWatch:vi.fn().mockResolvedValue(undefined),getCurrentPosition:vi.fn() } }));
describe('live tracking source and native GPS lifecycle',()=>{
  const id='00000000-0000-4000-8000-000000000001';
  const user=signal<{ role:string; isDemo:boolean }>({ role:'CUSTOMER',isDemo:true });
  const order=signal<{ id:string;status:string;expectedArrivalAt:null;coordinates:readonly [number,number] }>({ id,status:'EN_ROUTE',expectedArrivalAt:null,coordinates:[17.618111,121.718927] });
  const gps=signal<{ resource:string;fix:LiveFix }|null>(null);
  const live={ watch:vi.fn(()=>vi.fn()),gps,serverOffsetMs:signal(0),sendGps:vi.fn().mockReturnValue(true),events:new Subject() };
  const travelBookings=signal<{ id:string; status:string; coordinates:readonly [number,number]; expectedArrivalAt:null }[]>([]);
  const orders={ travelBookings,order,api:{ settings:{ useMockApi:signal(false) },post:vi.fn() },setStatus:vi.fn() };
  beforeEach(()=>{
    vi.useFakeTimers(); vi.clearAllMocks(); gps.set(null); travelBookings.set([]); user.set({ role:'CUSTOMER',isDemo:true }); order.set({ id,status:'EN_ROUTE',expectedArrivalAt:null,coordinates:[17.618111,121.718927] });
    TestBed.configureTestingModule({ providers:[{ provide:OrderService,useValue:orders },{ provide:AuthService,useValue:{ user,pro:signal({ isOnline:false }) } },{ provide:LiveService,useValue:live },{ provide:ApiService,useValue:orders.api }] });
  });
  afterEach(()=>{ TestBed.resetTestingModule(); vi.useRealTimers(); vi.restoreAllMocks(); });
  it('switches explicitly to the street simulator without changing API status or sending customer GPS',()=>{
    vi.spyOn(Math,'random').mockReturnValue(0.5);
    const tracking=TestBed.inject(TrackingService); TestBed.tick();
    expect(tracking.reconnecting()).toBe(true);
    tracking.setSimulated(true); TestBed.tick(); const start=tracking.displayDistance();
    vi.advanceTimersByTime(10000);
    expect(tracking.mode()).toBe('sim'); expect(tracking.displayDistance()).toBeGreaterThan(start);
    expect(orders.setStatus).not.toHaveBeenCalled(); expect(live.sendGps).not.toHaveBeenCalled();
    tracking.setSimulated(false); TestBed.tick(); expect(tracking.mode()).toBe('live'); expect(tracking.running()).toBe(false);
    user.set({ role:'CUSTOMER',isDemo:false }); tracking.setSimulated(true); expect(tracking.mode()).toBe('live');
  });
  it('snaps remote simulated fixes to real streets and keeps the last position after twenty seconds',()=>{
    const tracking=TestBed.inject(TrackingService); TestBed.tick();
    const point=TUGUEGARAO_ROUTE[8];
    gps.set({ resource:`booking:${id}`,fix:{ type:'gps',lat:point[0],lng:point[1],accuracy:5,ts:Date.now(),receivedAt:Date.now(),simulated:true } }); TestBed.tick();
    expect(tracking.hasFix()).toBe(true); expect(tracking.routeReady()).toBe(true); expect(tracking.reconnecting()).toBe(false);
    vi.advanceTimersByTime(1000); const distance=tracking.displayDistance();
    expect(tracking.route.project(tracking.sample(distance).point).error).toBeLessThan(0.01);
    vi.advanceTimersByTime(21000); expect(tracking.reconnecting()).toBe(true); expect(tracking.displayDistance()).toBe(distance);
  });
  it('restarts a remote demo route after receiving the previous run at its endpoint',()=>{
    const tracking=TestBed.inject(TrackingService); TestBed.tick();
    const send=(point:readonly [number,number])=>{gps.set({resource:`booking:${id}`,fix:{type:'gps',lat:point[0],lng:point[1],accuracy:5,ts:Date.now(),receivedAt:Date.now(),simulated:true}});TestBed.tick();};
    send(TUGUEGARAO_ROUTE[TUGUEGARAO_ROUTE.length-1]); vi.advanceTimersByTime(1000);
    send(TUGUEGARAO_ROUTE[8]); vi.advanceTimersByTime(1000);
    expect(tracking.routeReady()).toBe(true); expect(tracking.etaLabel()).toContain('Simulated route');
    expect(tracking.route.project(tracking.sample(tracking.displayDistance()).point).distance).toBeLessThan(tracking.route.total-500);
  });
  it('ignores a delayed live routing response after the remote source switches to simulation',async()=>{
    let resolve!: (response:Response)=>void;
    const fetcher=vi.spyOn(globalThis,'fetch').mockReturnValue(new Promise((r)=>resolve=r));
    const tracking=TestBed.inject(TrackingService); TestBed.tick();
    gps.set({resource:`booking:${id}`,fix:{type:'gps',lat:17.613,lng:121.727,accuracy:5,ts:Date.now(),receivedAt:Date.now()}}); TestBed.tick();
    const point=TUGUEGARAO_ROUTE[8]; gps.set({resource:`booking:${id}`,fix:{type:'gps',lat:point[0],lng:point[1],accuracy:5,ts:Date.now(),receivedAt:Date.now(),simulated:true}}); TestBed.tick();
    resolve({ok:true,json:async()=>({routes:[{geometry:{coordinates:[[121.74,17.63],[121.75,17.64]]}}]})} as Response);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(tracking.route.points).toEqual(TUGUEGARAO_ROUTE); expect(tracking.routeReady()).toBe(true); fetcher.mockRestore();
  });
  it('keeps GPS attached to an en-route job while a queued booking is selected',async()=>{
    user.set({ role:'PRO',isDemo:true }); travelBookings.set([order()]);
    TestBed.inject(TrackingService); TestBed.tick(); await Promise.resolve();
    const callback=vi.mocked(Geolocation.watchPosition).mock.calls[0][1];
    order.set({ ...order(),id:'00000000-0000-4000-8000-000000000002',status:'ACCEPTED' }); TestBed.tick();
    callback({ timestamp:Date.now(),coords:{ latitude:17.613,longitude:121.727,accuracy:8,heading:90 } } as never);
    expect(live.sendGps).toHaveBeenLastCalledWith(id,expect.objectContaining({ lat:17.613 }));
    expect(Geolocation.watchPosition).toHaveBeenCalledTimes(1);
    expect(Geolocation.clearWatch).not.toHaveBeenCalled();
  });
  it('keeps the destination without inventing provider GPS on arrival',()=>{
    const tracking=TestBed.inject(TrackingService); TestBed.tick();
    order.update((o)=>({ ...o,status:'ARRIVED',coordinates:[17.625,121.735] })); TestBed.tick();
    expect(tracking.hasFix()).toBe(false);
    expect(tracking.destination).toEqual([17.625,121.735]);
    expect(tracking.routeReady()).toBe(false);
  });

  it('sends permissioned Pro fixes while EN_ROUTE and clears the native watch after arrival',async()=>{
    user.set({ role:'PRO',isDemo:true }); const tracking=TestBed.inject(TrackingService); TestBed.tick(); await Promise.resolve();
    const callback=vi.mocked(Geolocation.watchPosition).mock.calls[0][1];
    callback({ timestamp:Date.now(),coords:{ latitude:17.613,longitude:121.727,accuracy:8,heading:90 } } as never);
    expect(live.sendGps).toHaveBeenCalledWith(id,expect.objectContaining({ lat:17.613,lng:121.727,accuracy:8 }));
    order.update((o)=>({ ...o,status:'ARRIVED' })); TestBed.tick();
    expect(Geolocation.clearWatch).toHaveBeenCalledWith({ id:'watch-1' }); expect(tracking.arrived()).toBe(true);
  });
});
