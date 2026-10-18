import { BookingCallService } from '../../../core/services/booking-call.service';
import { ChangeDetectionStrategy, Component, DestroyRef, ViewChild, computed, inject, signal } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { LiveService } from '../../../core/services/live.service';
import { MessageDto } from '../../../core/api/customer.models';
import { AuthService } from '../../../core/services/auth.service';
import { Location } from '@angular/common';
import { IonContent, IonFooter, IonHeader, IonIcon, IonToolbar } from '@ionic/angular';
import { SEED_CHAT } from '../../../core/data/mock-data';
import { OrderService } from '../../../core/services/order.service';
import { TrackingService } from '../../../core/services/tracking.service';
import { ChatMessage } from '../../../shared/models/domain.models';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

const AUTO_REPLIES = [
  'Got it 👍',
  'Noted, I’ll bring a spare drain hose just in case.',
  'Almost there — I’m heading into Ugac Norte now.',
  'Thanks! I’ll message when I’m at the gate.',
];

@Component({
  selector: 'app-order-chat',
  templateUrl: 'order-chat.page.html',
  styleUrl: 'order-chat.page.scss',
  imports: [IonHeader, IonToolbar, IonContent, IonFooter, IonIcon, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderChatPage {
  @ViewChild(IonContent) content?: IonContent;

  readonly orders = inject(OrderService);
  readonly sim = inject(TrackingService);
  private readonly location = inject(Location);

  readonly auth = inject(AuthService);
  readonly peer = computed(() => { const o = this.orders.order(); return this.auth.user()?.role === 'PRO' ? { name: o.customerName, avatarUrl: o.customerAvatarUrl, online: false } : { name: o.helper.name, avatarUrl: o.helper.avatarUrl, online: o.helper.isAvailable }; });
  readonly messages = signal<ChatMessage[]>(this.orders.api.settings.useMockApi() ? SEED_CHAT : []);
  readonly saving = signal(false);
  readonly error = signal('');
  private readonly live = inject(LiveService);
  private subscription?: Subscription;
  private timer?: ReturnType<typeof setInterval>;
  private generation = 0;
  private refreshGeneration?:number;
  private cursor?:string;
  private chatId='';
  private identity='';
  private leaveLive?:()=>void;
  private readonly route=inject(ActivatedRoute);
  private readonly rows=new Map<string,MessageDto>();
  private readonly photos=new Map<string,{url:string;expiresAt:number}>();
  private readonly photosLoading=new Set<string>();
  constructor() { inject(DestroyRef).onDestroy(() => this.stop()); }
  readonly draft = signal('');
  readonly typing = signal(false);
  private replyIndex = 0;

  back(): void {
    this.location.back();
  }

  ionViewWillEnter(): void {
    this.stop();
    const id=this.route.snapshot.paramMap.get('id') ?? this.orders.order().id;
    const identity=`${this.auth.user()?.id}:${id}`;
    if(identity!==this.identity){this.identity=identity;this.rows.clear();this.photos.clear();this.photosLoading.clear();this.cursor=undefined;this.messages.set(this.orders.api.settings.useMockApi()?SEED_CHAT:[]);}
    this.chatId=id;
    if(this.orders.api.settings.useMockApi())return;
    this.merge([...this.rows.values()]);
    this.leaveLive=this.live.watch(`booking:${id}`);
    this.subscription=this.live.events.subscribe(event=>{
      if(event.resource!==`booking:${id}`)return;
      if(event.type==='message' && event.message){this.merge([event.message]);return;}
      if(['connected','message'].includes(event.type))void this.refresh();
    });
    void this.refresh();
    // Live delivery is primary; incremental polling recovers missed/disconnected events.
    this.timer=setInterval(()=>void this.refresh(),10000);
  }
  ionViewDidEnter():void{void this.content?.scrollToBottom(0);}
  ionViewDidLeave(): void { this.stop(); }
  private stop(): void {
    this.subscription?.unsubscribe();this.subscription=undefined;this.leaveLive?.();this.leaveLive=undefined;
    clearInterval(this.timer);this.timer=undefined;this.photosLoading.clear();this.generation++;
  }
  private async refresh(): Promise<void> {
    const generation=this.generation;const id=this.chatId;
    if(this.refreshGeneration===generation)return;
    this.refreshGeneration=generation;
    try{
      let after=this.cursor;
      do{
        const result:{messages:MessageDto[];nextCursor:string|null}=await this.orders.api.get(`/bookings/${id}/messages`,after?{after}:undefined);
        if(generation!==this.generation)return;
        this.merge(result.messages);
        if(result.messages.length)this.cursor=result.messages[result.messages.length-1].id;
        after=result.nextCursor??undefined;
      }while(after);
      if(generation===this.generation)this.error.set('');
    }catch(error){if(generation===this.generation)this.error.set(error instanceof Error?error.message:'Could not load messages.');}
    finally{if(this.refreshGeneration===generation)this.refreshGeneration=undefined;}
  }
  private merge(messages:MessageDto[]):void{
    for(const message of messages)this.rows.set(message.id,message);
    this.renderMessages();
    const generation=this.generation;
    for(const message of this.rows.values()){
      const key=message.photoKey;if(!key||(this.photos.get(key)?.expiresAt ?? 0)>Date.now()||this.photosLoading.has(key))continue;
      this.photosLoading.add(key);
      void this.orders.api.imageUrl(key).then(url=>{
        if(generation!==this.generation)return;
        this.photos.set(key,{url,expiresAt:Date.now()+45000});this.renderMessages();
      }).catch(()=>undefined).finally(()=>{if(generation===this.generation)this.photosLoading.delete(key);});
    }
  }
  private renderMessages():void{
    const messages=[...this.rows.values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)).map((m):ChatMessage=>({
      id:m.id,from:!m.senderId?'system':m.senderId===this.auth.user()?.id?(this.auth.user()?.role==='PRO'?'helper':'customer'):(this.auth.user()?.role==='PRO'?'customer':'helper'),
      text:m.body,time:new Date(m.createdAt).toLocaleTimeString('en-PH',{hour:'numeric',minute:'2-digit'}),photoUrl:m.photoKey?this.photos.get(m.photoKey)?.url:undefined,
    }));
    this.messages.set(messages);
    void this.content?.scrollToBottom(0);
  }
  async send(): Promise<void> {
    const originalDraft=this.draft();
    const text = originalDraft.trim();
    if (!text || text.length > 2000 || this.saving()) return;
    if (!this.orders.api.settings.useMockApi()) {
      this.saving.set(true);
      const generation=this.generation;
      try { const {message}=await this.orders.api.post<{message:MessageDto}>(`/bookings/${this.chatId}/messages`, { body: text });
        if(generation===this.generation){this.merge([message]);if(this.draft()===originalDraft)this.draft.set('');this.error.set('');} }
      catch (error) { this.error.set(error instanceof Error ? error.message : 'Message was not sent.'); }
      finally { this.saving.set(false); } return;
    }
    this.push({ from: 'customer', text }); this.draft.set(''); this.typing.set(true);
    setTimeout(() => { this.typing.set(false); this.push({ from: 'helper', text: AUTO_REPLIES[this.replyIndex++ % AUTO_REPLIES.length] }); }, 1400);
  }

  async attach(): Promise<void> {
    if (this.saving() || !this.orders.isActive()) return;
    this.saving.set(true);
    const generation=this.generation;const id=this.chatId;
    try {
      const shot = await Camera.getPhoto({ source: CameraSource.Photos, resultType: CameraResultType.DataUrl, quality: 70, width: 1280, webUseInput: true });
      if (!shot.dataUrl || generation!==this.generation) return;
      if (this.orders.api.settings.useMockApi()) { this.push({ from: 'customer', text: '', photoUrl: shot.dataUrl }); return; }
      const blob = await (await fetch(shot.dataUrl)).blob();
      const photoKey = await this.orders.api.upload(blob, 'request_photo');
      if(generation!==this.generation)return;
      const {message}=await this.orders.api.post<{message:MessageDto}>(`/bookings/${id}/messages`,{photoKey});
      if(generation===this.generation)this.merge([message]);
    } catch (error) { if (!String(error).toLowerCase().includes('cancel')) this.error.set('Photo could not be sent. Please try again.'); }
    finally { this.saving.set(false); }
  }

  outgoing(m: ChatMessage): boolean { return m.from === (this.auth.user()?.role === 'PRO' ? 'helper' : 'customer'); }

  private readonly calls = inject(BookingCallService);
  call(): Promise<void> {
    return this.calls.call(this.orders.order().id);
  }

  private push(m: Omit<ChatMessage, 'id' | 'time'>): void {
    const time = new Date().toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
    this.messages.update((list) => [...list, { ...m, id: `m${Date.now()}`, time }]);
    setTimeout(() => this.content?.scrollToBottom(250), 30);
  }
}
