import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ApiService } from '../api/api.service';
import { LIVE_STALE_MS, LiveService } from './live.service';

class Socket {
  static OPEN=1;
  static all:Socket[]=[];
  readyState=1;
  onopen?:()=>void; onclose?:()=>void; onerror?:()=>void; onmessage?:({data}:{data:string})=>void;
  send=vi.fn(); close=vi.fn(()=>this.onclose?.());
  constructor(readonly url:string) { Socket.all.push(this); }
}
describe('live connection lifecycle',()=>{
  const api={ settings:{ apiUrl:signal('http://192.168.1.9:8787/api/v1') },post:vi.fn() };
  beforeEach(()=>{ vi.useFakeTimers(); Socket.all=[]; vi.stubGlobal('WebSocket',Socket); api.post.mockResolvedValue({ token:'short-lived-ticket' }); TestBed.configureTestingModule({ providers:[{ provide:ApiService,useValue:api }] }); });
  afterEach(()=>{ TestBed.resetTestingModule(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
  it('uses a scoped ticket URL, shares a socket and reconnects without losing the last location',async()=>{
    const live=TestBed.inject(LiveService);
    const leave=live.watch('booking:order-id'),second=live.watch('booking:order-id');
    await Promise.resolve(); const socket=Socket.all[0]; socket.onopen?.();
    expect(api.post).toHaveBeenCalledWith('/bookings/order-id/live-ticket',{});
    expect(socket.url).toBe('ws://192.168.1.9:8787/api/v1/bookings/order-id/live?token=short-lived-ticket');
    socket.onmessage?.({ data:JSON.stringify({ type:'gps',lat:17.613,lng:121.727,accuracy:5,ts:Date.now(),receivedAt:Date.now() }) });
    expect(live.gps()?.fix.lat).toBe(17.613);
    leave(); expect(socket.close).not.toHaveBeenCalled();
    socket.close(); expect(live.gps()?.fix.lat).toBe(17.613);
    await vi.advanceTimersByTimeAsync(1000); expect(Socket.all).toHaveLength(2);
    second(); expect(Socket.all[1].close).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30000); expect(Socket.all).toHaveLength(2);
  });
  it('replaces a socket that went silent without a close event (locked phone)',async()=>{
    const live=TestBed.inject(LiveService);
    live.watch('user:user-id'); await Promise.resolve();
    expect(api.post).toHaveBeenCalledWith('/me/live-ticket',{});
    expect(Socket.all[0].url).toBe('ws://192.168.1.9:8787/api/v1/me/live?token=short-lived-ticket');
    Socket.all[0].onopen?.(); expect(live.connected().has('user:user-id')).toBe(true);
    Socket.all[0].close=vi.fn(); // A dead mobile socket never reports its closure.
    await vi.advanceTimersByTimeAsync(LIVE_STALE_MS+10000);
    expect(Socket.all).toHaveLength(2); expect(live.connected().has('user:user-id')).toBe(false);
  });
  it('reconnects every channel on demand (app resume)',async()=>{
    const live=TestBed.inject(LiveService);
    live.watch('booking:order-id'); await Promise.resolve(); Socket.all[0].onopen?.();
    live.reconnectAll(); await Promise.resolve();
    expect(Socket.all).toHaveLength(2);
  });
  it('ignores a late ticket after the last screen leaves',async()=>{
    let finish!:(value:{ token:string })=>void;
    api.post.mockReturnValueOnce(new Promise((resolve)=>{ finish=resolve; }));
    const leave=TestBed.inject(LiveService).watch('pro:pro-id'); leave(); finish({ token:'late' }); await Promise.resolve();
    expect(Socket.all).toHaveLength(0);
  });
});
