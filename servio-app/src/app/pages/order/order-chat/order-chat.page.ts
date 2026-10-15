import { ChangeDetectionStrategy, Component, ViewChild, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { AlertController, IonContent, IonFooter, IonHeader, IonIcon, IonToolbar } from '@ionic/angular';
import { SEED_CHAT } from '../../../core/data/mock-data';
import { OrderService } from '../../../core/services/order.service';
import { TrackingSimService } from '../../../core/services/tracking-sim.service';
import { ChatMessage } from '../../../shared/models/domain.models';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

const AUTO_REPLIES = [
  'Got it 👍',
  'Noted, I’ll bring a spare drain hose just in case.',
  'Almost there — traffic on Jupiter St is light.',
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
  readonly sim = inject(TrackingSimService);
  private readonly location = inject(Location);
  private readonly alerts = inject(AlertController);

  readonly messages = signal<ChatMessage[]>(SEED_CHAT);
  readonly draft = signal('');
  readonly typing = signal(false);
  private replyIndex = 0;

  back(): void {
    this.location.back();
  }

  ionViewDidEnter(): void {
    this.content?.scrollToBottom(0);
  }

  send(): void {
    const text = this.draft().trim();
    if (!text) return;
    this.push({ from: 'customer', text });
    this.draft.set('');
    this.typing.set(true);
    setTimeout(() => {
      this.typing.set(false);
      this.push({ from: 'helper', text: AUTO_REPLIES[this.replyIndex++ % AUTO_REPLIES.length] });
    }, 1400);
  }

  async attach(): Promise<void> {
    const a = await this.alerts.create({ header: 'Share a photo', message: 'Photos you share stay inside this order’s chat.', buttons: ['OK'] });
    await a.present();
  }

  async call(): Promise<void> {
    const a = await this.alerts.create({
      header: 'Masked call',
      subHeader: `Connecting to ${this.orders.order().helper.name}…`,
      message: 'Neither number is revealed. Calls work only while this order is active.',
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
