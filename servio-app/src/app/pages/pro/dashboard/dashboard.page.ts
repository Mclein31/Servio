import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonHeader, IonIcon, IonToggle, IonToolbar } from '@ionic/angular';
import { OrderService } from '../../../core/services/order.service';
import { WalletService } from '../../../core/services/wallet.service';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { PhpPipe } from '../../../shared/pipes/php.pipe';

/** Servio Pro home: availability, today's earnings and the dispatch radar. */
@Component({
  selector: 'app-pro-dashboard',
  imports: [IonHeader, IonToolbar, IonContent, IonIcon, IonToggle, RouterLink, AvatarComponent, PhpPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar class="servio-app-bar">
        <div class="bar">
          <div class="lockup">
            <img src="assets/logo/servio_app_icon_orange.png" alt="" width="32" height="32" />
            <span class="wordmark">SERVIO</span><span class="pro">PRO</span>
          </div>
          <a routerLink="/tabs/profile" class="switch" aria-label="Switch to customer mode"><ion-icon name="swap-horizontal-outline" aria-hidden="true"></ion-icon></a>
          <app-avatar src="assets/avatars/daniel.png" name="Daniel K." [size]="40"></app-avatar>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content class="servio-page">
      <div class="wrap">
        <section class="availability" [class.off]="!online()">
          <div>
            <strong>{{ online() ? 'ONLINE · Ready for jobs' : 'OFFLINE' }}</strong>
            <span>You control when you accept work.</span>
          </div>
          <ion-toggle [checked]="online()" (ionChange)="online.set($any($event).detail.checked)" aria-label="Online for jobs"></ion-toggle>
        </section>

        <section class="servio-card earnings">
          <span class="servio-caption">Today's net earnings</span>
          <strong class="price">{{ wallet.todayNetPhp() | php }}</strong>
          <div class="mini">
            <div><b>3</b><span>Jobs done</span></div>
            <div><b>4.95</b><span>Rating</span></div>
            <div><b class="price">{{ wallet.pendingEscrowPhp() | php: 'whole' }}</b><span>In escrow</span></div>
          </div>
        </section>

        <section class="radar" [class.paused]="!online()" aria-label="Dispatch radar">
          <span class="wave w1"></span><span class="wave w2"></span><span class="wave w3"></span>
          <span class="sweep" aria-hidden="true"></span>
          <img src="assets/logo/servio_app_icon_orange.png" alt="" width="64" height="64" />
          <p>{{ online() ? 'Scanning within 10 km…' : 'Go online to receive jobs' }}</p>
        </section>

        <a class="pill-btn block" routerLink="/pro/radar-alert" [attr.aria-disabled]="!online()">
          <ion-icon name="radio-outline" aria-hidden="true"></ion-icon> Simulate incoming job
        </a>

        <nav class="servio-card links">
          <a routerLink="/pro/wallet"><ion-icon name="wallet-outline" aria-hidden="true"></ion-icon><span>My Wallet · <b class="price">{{ wallet.availablePhp() | php }}</b></span><ion-icon name="chevron-forward" aria-hidden="true"></ion-icon></a>
          <a [routerLink]="['/pro/order', orders.order().id, 'execute']"><ion-icon name="construct-outline" aria-hidden="true"></ion-icon><span>Active job · #{{ orders.order().id }}</span><ion-icon name="chevron-forward" aria-hidden="true"></ion-icon></a>
          <a routerLink="/tabs/home"><ion-icon name="person-outline" aria-hidden="true"></ion-icon><span>Back to customer app</span><ion-icon name="chevron-forward" aria-hidden="true"></ion-icon></a>
        </nav>
      </div>
    </ion-content>
  `,
  styleUrl: './dashboard.page.scss',
})
export class ProDashboardPage {
  readonly wallet = inject(WalletService);
  readonly orders = inject(OrderService);
  readonly online = signal(true);
}
