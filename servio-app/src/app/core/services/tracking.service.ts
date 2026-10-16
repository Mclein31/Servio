import { computed, effect, inject, Injectable, NgZone, OnDestroy, signal, untracked } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Point, RouteSample, RouteTrack } from '../../shared/utils/route-track';
import { TUGUEGARAO_ROUTE } from '../data/tuguegarao-route';
import { environment } from '../../../environments/environment';
import { OrderService } from './order.service';
import { AuthService } from './auth.service';
import { LiveFix, LiveService } from './live.service';

interface Fix { distance:number; at:number }
const START_REMAINING_M=1400;
const NOMINAL_SPEED_MPS=START_REMAINING_M/(12*60);
const TIME_SCALE=8;
export const FIX_INTERVAL_MS=1000;
const ARRIVAL_THRESHOLD_M=4;
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27}$/;

/** Both sources drive the same street-distance interpolation. Only the API advances a live job. */
@Injectable({ providedIn:'root' })
export class TrackingService implements OnDestroy {
  private readonly orders=inject(OrderService);
  private readonly auth=inject(AuthService);
  private readonly live=inject(LiveService);
  private readonly zone=inject(NgZone);
  private readonly travelTargets=computed(() => {
    const selected=this.orders.order();
    const active=[...(this.orders.travelBookings?.() ?? [])];
    if(selected.status==='EN_ROUTE' && !active.some((b)=>b.id===selected.id)) active.push(selected);
    return active;
  });
  private readonly context=computed(() => {
    const selected=this.orders.order();
    const travel=this.auth.user()?.role==='PRO' ? this.travelTargets()[0] : undefined;
    return travel ? { ...selected,...travel } : selected;
  });
  private readonly track=signal(new RouteTrack(TUGUEGARAO_ROUTE,'geo'));
  get route():RouteTrack { return this.track(); }
  get startDistance():number { return Math.max(0,this.route.total-START_REMAINING_M); }
  get destination():Point { return this.mode()==='live' && !this.live.gps()?.fix.simulated && this.context().coordinates ? this.context().coordinates! : this.route.points[this.route.points.length-1]; }
  get origin():Point { return this.route.points[0]; }
  readonly demoAllowed=computed(()=>environment.demo && (this.orders.api.settings.useMockApi() || this.auth.user()?.isDemo===true));
  readonly simulate=signal(false);
  readonly locationError=signal('');
  readonly hasFix=signal(false);
  readonly routeReady=signal(true);
  readonly mode=computed(()=>this.orders.api.settings.useMockApi() || this.demoAllowed() && this.simulate()?'sim':'live');
  readonly running=signal(false);
  private prev:Fix={ distance:this.startDistance,at:0 };
  private readonly latest=signal<Fix>({ distance:this.startDistance,at:0 });
  private readonly rawPoint=signal<Point|null>(null);
  private readonly receivedAt=signal(0);
  private readonly clock=signal(Date.now());
  private timer:ReturnType<typeof setInterval>|null=null;
  private readonly clockTimer:ReturnType<typeof setInterval>;
  private stoppedTicks=0;
  private routeAttempt='';
  private roadGeometry=false;
  private generation=0;
  private contextKey='';
  private readonly foreground=signal(true);
  private appListener?:Promise<PluginListenerHandle>;
  private lastAvailability=0;
  private lastSent=0;

  readonly remainingM=computed(()=>Math.max(0,this.route.total-this.latest().distance));
  readonly etaMinutes=computed(()=>Math.max(1,Math.ceil(this.remainingM()/NOMINAL_SPEED_MPS/60)));
  readonly arrived=computed(()=>this.orders.api.settings.useMockApi()?this.remainingM()<=ARRIVAL_THRESHOLD_M:['ARRIVED','IN_PROGRESS','COMPLETED'].includes(this.context().status));
  readonly legProgress=computed(()=>Math.max(0,1-this.remainingM()/START_REMAINING_M));
  readonly reconnecting=computed(()=>this.mode()==='live' && this.context().status==='EN_ROUTE' && (!this.hasFix() || this.clock()-this.receivedAt()>20000));
  readonly etaLabel=computed(()=>{
    const o=this.context();
    if(!this.orders.api.settings.useMockApi()) {
      if(o.status==='PENDING_ACCEPTANCE') return 'Waiting for Pro acceptance';
      if(o.status==='ACCEPTED') return 'Your helper is getting ready';
      if(o.status==='ARRIVED' || o.status==='IN_PROGRESS') return 'Your helper has arrived';
      if(o.status==='COMPLETED') return 'Job complete';
      if(o.status==='CANCELLED') return 'Booking cancelled';
      if(this.mode()==='sim') return `Simulated route · ${formatDistance(this.remainingM())}`;
      if(this.reconnecting()) return 'Reconnecting…';
      if(this.live.gps()?.fix.simulated) return this.routeReady() ? `Simulated route · ${formatDistance(this.remainingM())}` : 'Simulated location · route unavailable';
      if(!this.routeReady()) return 'Live location · route unavailable';
      return o.expectedArrivalAt?`Expected at ${new Date(o.expectedArrivalAt).toLocaleTimeString('en-PH',{ hour:'numeric',minute:'2-digit' })}`:'Live location';
    }
    return this.arrived()?'Your helper has arrived':`Arriving in ${this.etaMinutes()} min${this.etaMinutes()===1?'':'s'} (${formatDistance(this.remainingM())})`;
  });

  constructor() {
    if(Capacitor.isNativePlatform()) this.appListener=App.addListener('appStateChange',({ isActive })=>this.foreground.set(isActive));
    this.clockTimer=setInterval(()=>this.clock.set(Date.now()),1000);
    const control=computed(()=>`${this.context().id}:${this.context().status}:${this.mode()}`);
    effect(()=>{
      control();
      untracked(()=>{
        const key=`${this.context().id}:${this.mode()}`;
        const status=this.context().status;
        const atDestination=['ARRIVED','IN_PROGRESS','COMPLETED'].includes(status);
        if(this.contextKey===key) {
          if(status==='EN_ROUTE' && this.mode()==='sim') this.start();
          if(status!=='EN_ROUTE') {
            this.generation++;
            this.park(atDestination?this.route.total:this.latest().distance);
            if(atDestination && this.mode()==='live' && this.context().coordinates) {
              this.rawPoint.set(this.context().coordinates!);
              if(!this.roadGeometry) this.routeReady.set(false);
            }
          }
          return;
        }
        this.contextKey=key;
        this.generation++; this.routeAttempt=''; this.roadGeometry=false; this.hasFix.set(false); this.rawPoint.set(null);
        this.track.set(new RouteTrack(TUGUEGARAO_ROUTE,'geo'));
        if(this.mode()==='sim' && status==='EN_ROUTE') { this.park(this.startDistance); this.start(); }
        else this.park(['ARRIVED','IN_PROGRESS','COMPLETED'].includes(status)?this.route.total:this.startDistance);
        if(this.mode()==='live') {
          this.routeReady.set(false);
          if(atDestination && this.context().coordinates) this.rawPoint.set(this.context().coordinates!);
          const data=this.live.gps(); if(data?.resource===`booking:${this.context().id}`) this.ingest(data.fix); }
        else this.routeReady.set(true);
      });
    });
    effect(()=>{
      const data=this.live.gps();
      if(data?.resource===`booking:${this.context().id}` && this.mode()==='live') untracked(()=>this.ingest(data.fix));
    });
    const travelRooms=computed(()=>this.orders.api.settings.useMockApi() || this.auth.user()?.role!=='PRO' ? '' : this.travelTargets().map((b)=>b.id).filter((id)=>uuid.test(id)).sort().join(','));
    effect((cleanup)=>{
      const ids=travelRooms().split(',').filter(Boolean);
      const stops=ids.map((id)=>this.live.watch(`booking:${id}`));
      const subscription=this.live.events.subscribe((event)=>{
        if(event.type==='status' && ids.some((id)=>event.resource===`booking:${id}`)) {
          void this.orders.refresh();
          if(event.reset && this.mode()==='sim') this.replay();
        }
      });
      cleanup(()=>{ subscription.unsubscribe(); stops.forEach((stop)=>stop()); });
    });
    const locationControl=computed(()=>`${this.auth.user()?.role}:${this.auth.pro?.()?.isOnline}:${this.context().id}:${this.context().status}:${this.mode()}:${this.foreground()}`);
    effect((cleanup)=>{
      locationControl();
      untracked(()=>{
        if(!this.foreground() || this.orders.api.settings.useMockApi() || this.auth.user()?.role!=='PRO' || this.mode()==='sim') return;
        if(!this.auth.pro?.()?.isOnline && !this.travelTargets().length) return;
        let stopped=false; let watchId:string|undefined;
        void Geolocation.watchPosition({ enableHighAccuracy:true,timeout:15000,maximumAge:0,minimumUpdateInterval:1000,interval:1000 },(position,error)=>{
          if(stopped) return;
          if(error || !position) { this.locationError.set('Location unavailable. Enable precise location, or use the demo route indoors.'); return; }
          this.locationError.set('');
          const fix={ lat:position.coords.latitude,lng:position.coords.longitude,accuracy:position.coords.accuracy,heading:position.coords.heading,ts:position.timestamp };
          if(this.travelTargets().length) this.send(fix);
          else if(this.auth.pro?.()?.isOnline && Date.now()-this.lastAvailability>=30000) {
            this.lastAvailability=Date.now();
            void this.orders.api.post('/pro/location',{ lat:fix.lat,lng:fix.lng }).catch(()=>undefined);
          }
        }).then((id)=>{ watchId=id; if(stopped) void Geolocation.clearWatch({ id }); }).catch(()=>this.locationError.set('Location permission is required for live tracking.'));
        cleanup(()=>{ stopped=true; if(watchId) void Geolocation.clearWatch({ id:watchId }); });
      });
    });
  }
  ngOnDestroy():void { this.stopTimer(); clearInterval(this.clockTimer); void this.appListener?.then((listener)=>listener.remove()); }
  setSimulated(enabled:boolean):void { if(this.demoAllowed()) { this.simulate.set(enabled); this.locationError.set(''); } }
  async currentLocation():Promise<{ lat:number; lng:number }> {
    if(this.mode()==='sim' && environment.demo) { const point=this.route.sample(this.startDistance).point; return { lat:point[0],lng:point[1] }; }
    if(Capacitor.isNativePlatform()) await Geolocation.requestPermissions({ permissions:['location'] });
    const position=await Geolocation.getCurrentPosition({ enableHighAccuracy:true,timeout:15000,maximumAge:0 });
    return { lat:position.coords.latitude,lng:position.coords.longitude };
  }
  displayDistance(now=performance.now()):number {
    const cur=this.latest(); if(!this.running()) return cur.distance;
    const fraction=Math.min(1,Math.max(0,(now-cur.at)/FIX_INTERVAL_MS));
    return this.prev.distance+(cur.distance-this.prev.distance)*fraction;
  }
  sample(distance:number):RouteSample & { smoothBearing:number } {
    const sample=this.route.sample(distance);
    return { ...sample,...(!this.routeReady() && this.rawPoint()?{ point:this.rawPoint()! }:{}),smoothBearing:this.route.smoothedBearing(distance,30) };
  }
  replay():void {
    if(this.orders.api.settings.useMockApi()) this.orders.setStatus('EN_ROUTE');
    else if(this.mode()!=='sim') return;
    this.park(this.startDistance); this.start();
  }
  private ingest(fix:LiveFix):void {
    if(this.context().status!=='EN_ROUTE') return;
    this.hasFix.set(true); this.receivedAt.set(fix.receivedAt-this.live.serverOffsetMs()); this.rawPoint.set([fix.lat,fix.lng]);
    if(fix.simulated && environment.demo) {
      if(this.routeAttempt!=='sim') { this.routeAttempt='sim'; this.roadGeometry=true; this.track.set(new RouteTrack(TUGUEGARAO_ROUTE,'geo')); this.park(0); }
      this.routeReady.set(true);
    } else if(!this.routeAttempt || this.routeAttempt==='sim') {
      this.routeAttempt=this.context().id; this.roadGeometry=false; const generation=this.generation;
      const destination=this.context().coordinates;
      if(destination && !environment.production) void this.fetchRoute([fix.lat,fix.lng],destination,generation);
      this.routeReady.set(false);
    }
    let projected=this.route.project([fix.lat,fix.lng],Math.max(0,this.latest().distance-30));
    // A demo sender may replay from the start while the receiver still holds its previous last fix.
    if(fix.simulated && environment.demo && projected.error>80) {
      const replay=this.route.project([fix.lat,fix.lng]);
      if(replay.error<=80 && replay.distance<this.latest().distance-30) { this.park(replay.distance); projected=replay; }
    }
    if(projected.error<=Math.max(80,Math.min(fix.accuracy,150)) && this.roadGeometry) {
      this.routeReady.set(true);
      this.prev={ distance:this.displayDistance(),at:performance.now() };
      this.latest.set({ distance:projected.distance,at:performance.now() }); this.running.set(true);
    } else { this.routeReady.set(false); this.running.set(false); }
  }
  private async fetchRoute(from:Point,to:Point,generation:number):Promise<void> {
    try {
      const response=await fetch(`https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`,{ signal:AbortSignal.timeout(6000) });
      if(!response.ok) return;
      const body=await response.json() as { routes?:{ geometry:{ coordinates:number[][] } }[] };
      const points=body.routes?.[0]?.geometry.coordinates;
      if(generation!==this.generation || this.routeAttempt!==this.context().id || this.mode()!=='live' || !points || points.length<2 || points.some((p)=>!Number.isFinite(p[0]) || !Number.isFinite(p[1]) || Math.abs(p[0])>180 || Math.abs(p[1])>90)) return;
      this.roadGeometry=true; this.track.set(new RouteTrack(points.map((p)=>[p[1],p[0]] as Point),'geo')); this.park(0); this.routeReady.set(true);
      const latest=this.live.gps(); if(latest?.resource===`booking:${this.context().id}`) this.ingest(latest.fix);
    } catch { /* Keep the actual fix; never invent a street route after a router failure. */ }
  }
  private send(fix:Omit<LiveFix,'type'|'receivedAt'>):void {
    if(this.auth.user()?.role!=='PRO' || Date.now()-this.lastSent<1000) return;
    let sent=false;
    for(const target of this.travelTargets()) if(uuid.test(target.id)) sent=this.live.sendGps(target.id,fix) || sent;
    if(sent) this.lastSent=Date.now();
  }
  private start():void {
    if(this.timer) return;
    const at=performance.now(); this.prev={ distance:this.latest().distance,at }; this.latest.set({ distance:this.prev.distance,at }); this.running.set(true);
    this.zone.runOutsideAngular(()=>{ this.timer=setInterval(()=>this.tick(),FIX_INTERVAL_MS); });
  }
  private park(distance:number):void {
    this.stopTimer(); this.running.set(false); const at=performance.now(); this.prev={ distance,at }; this.latest.set({ distance,at });
  }
  private tick():void {
    if(!this.foreground()) return;
    const cur=this.latest(); let step=0;
    if(this.stoppedTicks>0) this.stoppedTicks--;
    else if(Math.random()<0.05 && this.remainingM()>150) this.stoppedTicks=1+Math.floor(Math.random()*3);
    else step=NOMINAL_SPEED_MPS*TIME_SCALE*(0.75+Math.random()*0.5)*this.route.cornerFactor(cur.distance,35,0.4);
    const next=Math.min(this.route.total,cur.distance+step);
    this.prev={ distance:this.displayDistance(),at:performance.now() }; this.latest.set({ distance:next,at:performance.now() });
    if(!this.orders.api.settings.useMockApi()) {
      const point=this.route.sample(next).point;
      this.send({ lat:point[0],lng:point[1],accuracy:5,heading:this.route.sample(next).bearing,ts:Date.now(),simulated:true });
    } else if(this.route.total-next<=ARRIVAL_THRESHOLD_M) {
      this.stopTimer(); setTimeout(()=>{ if(this.orders.api.settings.useMockApi()) this.zone.run(()=>this.orders.setStatus('ARRIVED')); },FIX_INTERVAL_MS);
    }
  }
  private stopTimer():void { if(this.timer) clearInterval(this.timer); this.timer=null; }
}
export function formatDistance(m:number):string { return m>=1000?`${(m/1000).toFixed(1)} km`:`${Math.max(10,Math.round(m/10)*10)} m`; }
