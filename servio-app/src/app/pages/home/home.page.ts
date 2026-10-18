import { DiscoveryLocationComponent } from '../../shared/components/discovery-location/discovery-location.component';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ActionSheetController, IonContent, IonHeader, IonIcon, IonToolbar, ToastController } from '@ionic/angular';
import { CATEGORIES } from '../../core/data/mock-data';
import { CommunityService } from '../../core/services/community.service';
import { AuthService } from '../../core/services/auth.service';
import { OrderService } from '../../core/services/order.service';
import { SheetsService } from '../../core/services/sheets.service';
import { TrackingService } from '../../core/services/tracking.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { HelperCardComponent } from '../../shared/components/helper-card/helper-card.component';
import { SearchFilterComponent } from '../../shared/components/search-filter/search-filter.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { PhpPipe } from '../../shared/pipes/php.pipe';

const MINI_STEPS = ['Accepted', 'On the Way', 'Arrived', 'Done'];

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrl: 'home.page.scss',
  imports: [DiscoveryLocationComponent,IonHeader, IonToolbar, IonContent, IonIcon, RouterLink, SearchFilterComponent, StatusBadgeComponent, HelperCardComponent, AvatarComponent, PhpPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  private readonly router = inject(Router);
  private readonly sheets = inject(SheetsService);
  private readonly toasts = inject(ToastController);
  private readonly actionSheets = inject(ActionSheetController);
  readonly orders = inject(OrderService);
  readonly sim = inject(TrackingService);

  readonly community = inject(CommunityService);
  readonly auth = inject(AuthService);
  ionViewWillEnter(): void {
    void this.community.refresh();
    void this.auth.refreshProfile();
  }
  readonly firstName = computed(() => this.auth.user()?.fullName?.split(' ')[0] ?? 'neighbor');
  readonly categories = CATEGORIES;
  readonly bulletin = computed(() => this.community.requests().filter(r=>r.status!=='CANCELLED').slice(0, 3));
  readonly helpers = this.community.helpers;
  readonly categoryById = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
  readonly miniSteps = MINI_STEPS;

  readonly greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  })();

  /** Mini 4-step bar: index of the current step and smooth fill across the en-route leg. */
  readonly miniProgress = computed(() => {
    const status = this.orders.order().status;
    const leg = Math.min(1, Math.max(0, this.sim.legProgress()));
    switch (status) {
      case 'ACCEPTED': return { index: 0, fill: 0 };
      case 'EN_ROUTE': return { index: 1, fill: (1 + leg) / 3 };
      case 'ARRIVED':
      case 'IN_PROGRESS': return { index: 2, fill: 2 / 3 };
      case 'COMPLETED': return { index: 3, fill: 1 };
      default: return { index: 0, fill: 0 };
    }
  });

  readonly statusLine = computed(() => {
    switch (this.orders.order().status) {
      case 'ACCEPTED': return 'Helper assigned · preparing to leave';
      case 'EN_ROUTE': return this.sim.etaLabel();
      case 'ARRIVED': return 'Arrived at your door';
      case 'IN_PROGRESS': return 'Work in progress';
      default: return '';
    }
  });

  openHelper(id: string): void {
    this.sheets.openHelperProfile(id);
  }

  book(id: string): void {
    this.router.navigate(['/checkout'], { queryParams: { helper: id } });
  }

  search(term: string): void {
    if (term.trim().length > 2) this.router.navigate(['/tabs/directory'], { queryParams: { q: term.trim() } });
  }

  openCategory(id: string): void {
    this.router.navigate(['/tabs/directory'], { queryParams: { category: id } });
  }

  async openNotifications(): Promise<void> {
    const toast = await this.toasts.create({
      message: 'You have no new notifications.',
      duration: 2000,
      position: 'top',
    });
    await toast.present();
  }

  async openFilters(): Promise<void> {
    const buttons = CATEGORIES.map((c) => ({
      text: c.label,
      icon: c.icon,
      handler: () => {
        this.openCategory(c.id);
      },
    }));
    const sheet = await this.actionSheets.create({
      header: 'Browse by Category',
      buttons: [
        {
          text: 'All Services',
          icon: 'apps-outline',
          handler: () => {
            this.router.navigate(['/tabs/directory']);
          },
        },
        ...buttons,
        {
          text: 'Cancel',
          role: 'cancel',
        },
      ],
    });
    await sheet.present();
  }
}
