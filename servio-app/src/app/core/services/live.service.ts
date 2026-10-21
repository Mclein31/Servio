// live connection
import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { Subject } from 'rxjs';
import type { MessageDto } from '../api/customer.models';
import { ApiService } from '../api/api.service';

export interface LiveFix { type:'gps'; lat:number; lng:number; accuracy:number; heading?:number|null; ts:number; receivedAt:number; simulated?:boolean }
export interface LiveEvent { resource:string; type:string; reset?:boolean; fix?:LiveFix; message?:MessageDto; bookingId?:string }
interface Channel { listeners:number; socket?:WebSocket; retry?:ReturnType<typeof setTimeout>; heartbeat?:ReturnType<typeof setInterval>; renew?:ReturnType<typeof setTimeout>; active:boolean; attempts:number; lastSeen:number; opening?:boolean }

export const LIVE_STALE_MS=25000;
const PING_MS=10000;

@Injectable({ providedIn:'root' })
export class LiveService implements OnDestroy {
  private readonly api=inject(ApiService);
  private readonly channels=new Map<string,Channel>();
  private readonly eventsSubject=new Subject<LiveEvent>();
  private appListener?:Promise<PluginListenerHandle>;
  private readonly onOnline=()=>this.reconnectAll();
  private readonly onVisible=()=>{ if(document.visibilityState==='visible') this.reconnectStale(); };
  readonly events=this.eventsSubject.asObservable();
  readonly serverOffsetMs=signal(0);
  readonly connected=signal<ReadonlySet<string>>(new Set());
  readonly gps=signal<{ resource:string; fix:LiveFix }|null>(null);

  constructor() {
    if(Capacitor.isNativePlatform()) this.appListener=App.addListener('appStateChange',({ isActive })=>{ if(isActive) this.reconnectAll(); });
    else document.addEventListener('visibilitychange',this.onVisible);
    globalThis.addEventListener?.('online',this.onOnline);
  }

  watch(resource:string):()=>void {
    let channel=this.channels.get(resource);
    if(channel) channel.listeners++;
    else { channel={ listeners:1,active:true,attempts:0,lastSeen:0 }; this.channels.set(resource,channel); void this.open(resource,channel); }
    const lease=channel;
    return ()=>{ if(--lease.listeners===0) { this.close(resource,lease); this.channels.delete(resource); if(this.gps()?.resource===resource) this.gps.set(null); } };
  }
  sendGps(bookingId:string,fix:Omit<LiveFix,'type'|'receivedAt'>):boolean {
    const ws=this.channels.get(`booking:${bookingId}`)?.socket;
    if(ws?.readyState!==WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ type:'gps',...fix })); return true;
  }
  reconnectAll():void { for(const [resource,channel] of this.channels) this.restart(resource,channel); }
  private reconnectStale():void { for(const [resource,channel] of this.channels) if(!channel.socket || Date.now()-channel.lastSeen>LIVE_STALE_MS) this.restart(resource,channel); }
  private restart(resource:string,channel:Channel):void {
    if(!channel.active || channel.opening) return;
    this.detach(channel); channel.attempts=0; this.setConnected(resource,false); void this.open(resource,channel);
  }
  private async open(resource:string,channel:Channel):Promise<void> {
    if(channel.opening) return;
    channel.opening=true;
    try {
      const [kind,id]=resource.split(':');
      const path=kind==='pro'?'/pro':kind==='user'?'/me':`/bookings/${id}`;
      const { token }=await this.api.post<{ token:string }>(`${path}/live-ticket`,{});
      if(!channel.active) return;
      const url=new URL(this.api.settings.apiUrl()+`${path}/live`); url.protocol=url.protocol==='https:'?'wss:':'ws:'; url.searchParams.set('token',token);
      const ws=new WebSocket(url.href); channel.socket=ws;
      ws.onopen=()=>{
        if(!channel.active || channel.socket!==ws) { ws.close(); return; }
        channel.attempts=0; channel.lastSeen=Date.now(); this.setConnected(resource,true);
        channel.heartbeat=setInterval(()=>{
          if(Date.now()-channel.lastSeen>LIVE_STALE_MS) { this.restart(resource,channel); return; }
          if(ws.readyState===WebSocket.OPEN) ws.send('ping');
        },PING_MS);
        channel.renew=setTimeout(()=>this.restart(resource,channel),270000);
      };
      ws.onmessage=(message)=>{
        if(!channel.active || channel.socket!==ws) return;
        channel.lastSeen=Date.now();
        if(message.data==='pong') return;
        try {
          const data=JSON.parse(String(message.data)) as Omit<LiveFix,'type'> & { type:string; reset?:boolean; serverNow?:number; message?:MessageDto; bookingId?:string };
          if(data.type==='connected' && typeof data.serverNow==='number') this.serverOffsetMs.set(data.serverNow-Date.now());
          if(data.type==='gps' && Number.isFinite(data.lat) && Number.isFinite(data.lng) && Number.isFinite(data.receivedAt)) this.gps.set({ resource,fix:{ ...data,type:'gps' } });
          if(data.reset && this.gps()?.resource===resource) this.gps.set(null);
          this.eventsSubject.next({ resource,type:data.type,reset:data.reset,message:data.message,bookingId:data.bookingId });
        } catch {}
      };
      ws.onerror=()=>ws.close();
      ws.onclose=()=>{ if(channel.socket!==ws) return; this.detach(channel); this.setConnected(resource,false); this.retry(resource,channel); };
    } catch { this.setConnected(resource,false); this.retry(resource,channel); }
    finally { channel.opening=false; }
  }
  private retry(resource:string,channel:Channel) {
    if(!channel.active) return;
    clearTimeout(channel.retry);
    channel.retry=setTimeout(()=>void this.open(resource,channel),Math.min(10000,1000*2**channel.attempts++));
  }
  private detach(channel:Channel) {
    this.clearTimers(channel);
    const ws=channel.socket; channel.socket=undefined;
    if(ws) { ws.onopen=ws.onmessage=ws.onerror=ws.onclose=null; try { ws.close(1000,'Reconnect'); } catch {} }
  }
  private setConnected(resource:string,value:boolean) { const next=new Set(this.connected()); if(value) next.add(resource); else next.delete(resource); this.connected.set(next); }
  private clearTimers(channel:Channel) { clearTimeout(channel.retry); clearTimeout(channel.renew); clearInterval(channel.heartbeat); }
  private close(resource:string,channel:Channel) { channel.active=false; this.detach(channel); this.setConnected(resource,false); }
  ngOnDestroy() {
    for(const [resource,channel] of this.channels) this.close(resource,channel);
    this.channels.clear(); this.eventsSubject.complete();
    void this.appListener?.then((listener)=>listener.remove());
    document.removeEventListener('visibilitychange',this.onVisible); globalThis.removeEventListener?.('online',this.onOnline);
  }
}
