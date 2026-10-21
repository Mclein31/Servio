// notification bell
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-notification-bell',
  imports: [IonIcon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="bell" routerLink="/notifications" [attr.aria-label]="label()">
      <ion-icon [name]="notifications.hasUnread() ? 'notifications' : 'notifications-outline'" aria-hidden="true"></ion-icon>
      @if (notifications.hasUnread()) { <span class="dot" aria-hidden="true"></span> }
    </a>
  `,
  styles: `
    :host { display: inline-flex; flex: 0 0 auto; }
    .bell {
      position: relative; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%;
      background: #FFFFFF; box-shadow: var(--servio-shadow-card); color: var(--servio-text-primary); font-size: 22px;
      text-decoration: none; -webkit-tap-highlight-color: transparent;
    }
    .bell:active { transform: scale(0.96); }
    .dot {
      position: absolute; top: 10px; right: 11px; width: 10px; height: 10px; border-radius: 50%;
      background: var(--servio-red); border: 2px solid #FFFFFF;
    }
  `,
})
export class NotificationBellComponent {
  readonly notifications = inject(NotificationService);
  readonly label = computed(() => {
    const count = this.notifications.unreadCount();
    return count ? `Notifications, ${count} unread` : 'Notifications';
  });
}
