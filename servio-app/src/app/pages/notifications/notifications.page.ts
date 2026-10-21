// notifications page
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { IonContent, IonHeader, IonIcon, IonRefresher, IonRefresherContent, IonTitle, IonToolbar } from '@ionic/angular';
import { AppNotification, NotificationKind, NotificationService } from '../../core/services/notification.service';
import { postedAgo } from '../../core/services/community.service';

const ICONS: Record<NotificationKind, { icon: string; tint: string; ink: string }> = {
  BOOKING: { icon: 'receipt-outline', tint: 'var(--servio-cat-repairs)', ink: '#D04A00' },
  MESSAGE: { icon: 'chatbubble-ellipses-outline', tint: 'var(--servio-cat-tutoring)', ink: '#2563EB' },
  ADDON: { icon: 'construct-outline', tint: 'var(--servio-amber-surface)', ink: '#B45309' },
  OFFER: { icon: 'flash-outline', tint: 'var(--servio-cat-tech)', ink: '#7C3AED' },
  BULLETIN: { icon: 'document-text-outline', tint: 'var(--servio-cat-errands)', ink: '#059669' },
  REVIEW: { icon: 'star-outline', tint: 'var(--servio-amber-surface)', ink: '#B45309' },
};

@Component({
  selector: 'app-notifications',
  templateUrl: 'notifications.page.html',
  styleUrl: 'notifications.page.scss',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonRefresher, IonRefresherContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsPage {
  readonly notifications = inject(NotificationService);
  private readonly location = inject(Location);
  readonly icons = ICONS;
  readonly ago = postedAgo;
  back(): void { this.location.back(); }
  ionViewWillEnter(): void { void this.notifications.refresh(); }
  async pull(event: CustomEvent): Promise<void> {
    await this.notifications.refresh();
    (event.target as HTMLIonRefresherElement).complete();
  }
  open(item: AppNotification): void { void this.notifications.open(item); }
  markAll(): void { void this.notifications.markAllRead().catch(() => undefined); }
}
