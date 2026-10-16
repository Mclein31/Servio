import { ChangeDetectionStrategy, Component, DestroyRef, ViewChild, computed, inject, signal } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Subscription } from 'rxjs';
import { LiveService } from '../../../core/services/live.service';
import { MessageDto } from '../../../core/api/customer.models';
import { AuthService } from '../../../core/services/auth.service';
import { Location } from '@angular/common';
import { AlertController, IonContent, IonFooter, IonHeader, IonIcon, IonToolbar } from '@ionic/angular';
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
  private readonly alerts = inject(AlertController);

  readonly auth = inject(AuthService);
  readonly peer = computed(() => { const o = this.orders.order(); return this.auth.user()?.role === 'PRO' ? { name: o.customerName, avatarUrl: o.customerAvatarUrl, online: false } : { name: o.helper.name, avatarUrl: o.helper.avatarUrl, online: o.helper.isAvailable }; });
  readonly messages = signal<ChatMessage[]>(this.orders.api.settings.useMockApi() ? SEED_CHAT : []);
  readonly saving = signal(false);
  readonly error = signal('');
  private readonly live = inject(LiveService);
  private subscription?: Subscription;
  private timer?: ReturnType<typeof setInterval>;
  private generation = 0;
  private refreshing = false;
  constructor() { inject(DestroyRef).onDestroy(() => this.stop()); }
  readonly draft = signal('');
  readonly typing = signal(false);
  private replyIndex = 0;

  back(): void {
    this.location.back();
  }

  ionViewDidEnter(): void {
    this.stop();
    this.content?.scrollToBottom(0);
    this.subscription=this.live.events.subscribe((event)=>{ if(event.resource===`booking:${this.orders.order().id}` && ['connected','message','status'].includes(event.type)) void this.refresh(); });
    if (!this.orders.api.settings.useMockApi()) { void this.refresh(); this.timer = setInterval(() => void this.refresh(), 3000); }
  }

  ionViewDidLeave(): void { this.stop(); }
  private stop(): void { this.subscription?.unsubscribe(); this.subscription=undefined; if (this.timer) clearInterval(this.timer); this.timer = undefined; this.generation++; }
  private async refresh(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;
    const generation = this.generation;
    try {
      const all: MessageDto[] = [];
      let after: string | null = null;
      do {
        const result: { messages: MessageDto[]; nextCursor: string | null } = await this.orders.api.get(`/bookings/${this.orders.order().id}/messages`, after ? { after } : undefined);
        all.push(...result.messages); after = result.nextCursor;
      } while (after);
      const messages = await Promise.all(all.map(async (m): Promise<ChatMessage> => ({ id: m.id, from: !m.senderId ? 'system' : m.senderId === this.orders.order().customerId ? 'customer' : 'helper',
        text: m.body, time: new Date(m.createdAt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }),
        photoUrl: m.photoKey ? await this.orders.api.imageUrl(m.photoKey) : undefined })));
      if (generation === this.generation) { this.messages.set(messages); this.error.set(''); }
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Could not load messages.'); }
    finally { this.refreshing = false; }
  }
  async send(): Promise<void> {
    const text = this.draft().trim();
    if (!text || text.length > 2000 || this.saving()) return;
    if (!this.orders.api.settings.useMockApi()) {
      this.saving.set(true);
      try { await this.orders.api.post(`/bookings/${this.orders.order().id}/messages`, { body: text }); this.draft.set(''); await this.refresh(); }
      catch (error) { this.error.set(error instanceof Error ? error.message : 'Message was not sent.'); }
      finally { this.saving.set(false); } return;
    }
    this.push({ from: 'customer', text }); this.draft.set(''); this.typing.set(true);
    setTimeout(() => { this.typing.set(false); this.push({ from: 'helper', text: AUTO_REPLIES[this.replyIndex++ % AUTO_REPLIES.length] }); }, 1400);
  }

  async attach(): Promise<void> {
    if (this.saving() || !this.orders.isActive()) return;
    this.saving.set(true);
    try {
      const shot = await Camera.getPhoto({ source: CameraSource.Photos, resultType: CameraResultType.DataUrl, quality: 70, width: 1280, webUseInput: true });
      if (!shot.dataUrl) return;
      if (this.orders.api.settings.useMockApi()) { this.push({ from: 'customer', text: '', photoUrl: shot.dataUrl }); return; }
      const blob = await (await fetch(shot.dataUrl)).blob();
      const photoKey = await this.orders.api.upload(blob, 'request_photo');
      await this.orders.api.post(`/bookings/${this.orders.order().id}/messages`, { photoKey });
      await this.refresh();
    } catch (error) { if (!String(error).toLowerCase().includes('cancel')) this.error.set('Photo could not be sent. Please try again.'); }
    finally { this.saving.set(false); }
  }

  outgoing(m: ChatMessage): boolean { return m.from === (this.auth.user()?.role === 'PRO' ? 'helper' : 'customer'); }

  async call(): Promise<void> {
    const a = await this.alerts.create({
      header: 'Masked call',
      subHeader: `Contact ${this.peer().name}`,
      message: 'Voice calls are not available in this demo. Use the booking chat.',
      buttons: [{ text: 'End call', role: 'cancel' }],
    });
    await a.present();
  }

  private push(m: Omit<ChatMessage, 'id' | 'time'>): void {
    const time = new Date().toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
    this.messages.update((list) => [...list, { ...m, id: `m${Date.now()}`, time }]);
    setTimeout(() => this.content?.scrollToBottom(250), 30);
  }
}
