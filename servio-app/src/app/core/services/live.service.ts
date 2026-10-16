import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { ApiService } from '../api/api.service';

export interface LiveFix { type:'gps'; lat:number; lng:number; accuracy:number; heading?:number|null; ts:number; receivedAt:number; simulated?:boolean }
export interface LiveEvent { resource:string; type:string; reset?:boolean; fix?:LiveFix }
interface Channel { listeners:number; socket?:WebSocket; retry?:ReturnType<typeof setTimeout>; heartbeat?:ReturnType<typeof setInterval>; renew?:ReturnType<typeof setTimeout>; active:boolean; attempts:number }

@Injectable({ providedIn:'root' })
export class LiveService implements OnDestroy {
  private readonly api=inject(ApiService);
  private readonly channels=new Map<string,Channel>();
  private readonly eventsSubject=new Subject<LiveEvent>();
  readonly events=this.eventsSubject.asObservable();
  readonly serverOffsetMs=signal(0);
  readonly connected=signal<ReadonlySet<string>>(new Set());
  readonly gps=signal<{ resource:string; fix:LiveFix }|null>(null);

  watch(resource:string):()=>void {
    let channel=this.channels.get(resource);
    if(channel) channel.listeners++;
    else { channel={ listeners:1,active:true,attempts:0 }; this.channels.set(resource,channel); void this.open(resource,channel); }
    const lease=channel;
    return ()=>{ if(--lease.listeners===0) { this.close(resource,lease); this.channels.delete(resource); if(this.gps()?.resource===resource) this.gps.set(null); } };
  }
  sendGps(bookingId:string,fix:Omit<LiveFix,'type'|'receivedAt'>):boolean {
    const ws=this.channels.get(`booking:${bookingId}`)?.socket;
    if(ws?.readyState!==WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ type:'gps',...fix })); return true;
  }
  private async open(resource:string,channel:Channel):Promise<void> {
    try {
      const [kind,id]=resource.split(':');
      const path=kind==='pro'?'/pro':`/bookings/${id}`;
      const { token }=await this.api.post<{ token:string }>(`${path}/live-ticket`,{});
      if(!channel.active) return;
      const url=new URL(this.api.settings.apiUrl()+`${path}/live`); url.protocol=url.protocol==='https:'?'wss:':'ws:'; url.searchParams.set('token',token);
      const ws=new WebSocket(url.href); channel.socket=ws;
      ws.onopen=()=>{
        if(!channel.active) { ws.close(); return; }
        channel.attempts=0; this.setConnected(resource,true);
        channel.heartbeat=setInterval(()=>{ if(ws.readyState===WebSocket.OPEN) ws.send('ping'); },15000);
        channel.renew=setTimeout(()=>ws.close(1000,'Renew'),270000);
      };
      ws.onmessage=(message)=>{
        if(!channel.active || message.data==='pong') return;
        try {
          const data=JSON.parse(String(message.data)) as Omit<LiveFix,'type'> & { type:string; reset?:boolean; serverNow?:number };
          if(data.type==='connected' && typeof data.serverNow==='number') this.serverOffsetMs.set(data.serverNow-Date.now());
          if(data.type==='gps' && Number.isFinite(data.lat) && Number.isFinite(data.lng) && Number.isFinite(data.receivedAt)) this.gps.set({ resource,fix:{ ...data,type:'gps' } });
          if(data.reset && this.gps()?.resource===resource) this.gps.set(null);
          this.eventsSubject.next({ resource,type:data.type,reset:data.reset });
        } catch { /* Ignore invalid transport frames; REST remains the source of record. */ }
      };
      ws.onerror=()=>ws.close();
      ws.onclose=()=>{ this.clearTimers(channel); this.setConnected(resource,false); this.retry(resource,channel); };
    } catch { this.setConnected(resource,false); this.retry(resource,channel); }
  }
  private retry(resource:string,channel:Channel) {
    if(!channel.active) return;
    channel.retry=setTimeout(()=>void this.open(resource,channel),Math.min(10000,1000*2**channel.attempts++));
  }
  private setConnected(resource:string,value:boolean) { const next=new Set(this.connected()); if(value) next.add(resource); else next.delete(resource); this.connected.set(next); }
  private clearTimers(channel:Channel) { clearTimeout(channel.retry); clearTimeout(channel.renew); clearInterval(channel.heartbeat); }
  private close(resource:string,channel:Channel) { channel.active=false; this.clearTimers(channel); channel.socket?.close(1000,'Leave'); this.setConnected(resource,false); }
  ngOnDestroy() { for(const [resource,channel] of this.channels) this.close(resource,channel); this.channels.clear(); this.eventsSubject.complete(); }
}
