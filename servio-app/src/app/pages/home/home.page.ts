import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonHeader, IonIcon, IonToolbar } from '@ionic/angular';
import { BULLETIN_REQUESTS, CATEGORIES, HELPERS } from '../../core/data/mock-data';
import { OrderService } from '../../core/services/order.service';
import { SheetsService } from '../../core/services/sheets.service';
import { TrackingSimService } from '../../core/services/tracking-sim.service';
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
  imports: [IonHeader, IonToolbar, IonContent, IonIcon, RouterLink, SearchFilterComponent, StatusBadgeComponent, HelperCardComponent, AvatarComponent, PhpPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  private readonly router = inject(Router);
  private readonly sheets = inject(SheetsService);
  readonly orders = inject(OrderService);
  readonly sim = inject(TrackingSimService);

  readonly categories = CATEGORIES.slice(0, 4);
  readonly bulletin = BULLETIN_REQUESTS.slice(0, 3);
  readonly helpers = HELPERS.filter((h) => h.id !== 'sophia');
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
      case 'EN_ROUTE': return `ETA ${this.sim.etaMinutes()} mins`;
      case 'ARRIVED': return 'Arrived at your door';
      case 'IN_PROGRESS': return 'Work in progress';
      default: return '';
    }
  });

  openHelper(id: string): void {
    this.sheets.openHelperProfile(id);
  }

  book(): void {
    this.router.navigateByUrl('/checkout');
  }

  search(term: string): void {
    if (term.trim().length > 2) this.router.navigate(['/tabs/directory'], { queryParams: { q: term.trim() } });
  }

  openCategory(id: string): void {
    this.router.navigate(['/tabs/directory'], { queryParams: { category: id } });
  }
}
