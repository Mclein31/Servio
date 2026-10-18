import { BookingCallService } from '../../core/services/booking-call.service';
import { TrackingControlsComponent } from '../../shared/components/tracking-controls/tracking-controls.component';
import { ChangeDetectionStrategy, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertController, IonAccordion, IonAccordionGroup, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonToolbar } from '@ionic/angular';
import { CommunityService } from '../../core/services/community.service';
import { formatPhp } from '../../shared/utils/money';
import { OrderService } from '../../core/services/order.service';
import { TrackingService } from '../../core/services/tracking.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { StepperComponent } from '../../shared/components/stepper/stepper.component';
import { TrackingMapComponent } from '../../shared/components/tracking-map/tracking-map.component';
import { PhpPipe } from '../../shared/pipes/php.pipe';
import { DecimalPipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

export function canShowProviderTracking(
  role: 'CUSTOMER' | 'PRO' | 'ADMIN' | undefined,
  customerId: string | undefined,
  userId: string | undefined,
  isActive: boolean,
  isMockApi: boolean,
): boolean {
  return role === 'CUSTOMER' && isActive && (isMockApi || (!!userId && customerId === userId));
}

@Component({
  selector: 'app-tracking',
  templateUrl: 'tracking.page.html',
  styleUrl: 'tracking.page.scss',
  imports: [TrackingControlsComponent,IonHeader, IonToolbar, IonContent, IonIcon, IonAccordionGroup, IonAccordion, IonItem, IonLabel, RouterLink, DecimalPipe,
    TrackingMapComponent, StepperComponent, AvatarComponent, PhpPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrackingPage {
  @ViewChild(TrackingMapComponent) map?: TrackingMapComponent;

  readonly orders = inject(OrderService);
  readonly community = inject(CommunityService);
  readonly sim = inject(TrackingService);
  readonly auth = inject(AuthService);
  private readonly alerts = inject(AlertController);
  readonly cancelling = signal(false);
  readonly history = computed(() => this.orders.history().filter((item) => item.status !== 'CANCELLED'));
  readonly canTrackProvider = computed(() => canShowProviderTracking(
    this.auth.user()?.role,
    this.orders.order().customerId,
    this.auth.user()?.id,
    this.orders.isActive(),
    this.orders.api.settings.useMockApi(),
  ));
  readonly partner = computed(() => {
    const o = this.orders.order();
    const isPro = this.auth.user()?.role === 'PRO';
    return isPro ? { name: o.customerName, avatarUrl: o.customerAvatarUrl, rating: 0, reviewCount: 0, isAvailable: false } : { name: o.helper.name, avatarUrl: o.helper.avatarUrl, rating: o.helper.rating, reviewCount: o.helper.reviewCount, isAvailable: o.helper.isAvailable };
  });

  readonly statusChip = computed(() => {
    switch (this.orders.order().status) {
      case 'ACCEPTED': return { label: 'Accepted', icon: 'checkmark-circle', tone: 'accepted' };
      case 'EN_ROUTE': return { label: 'On the Way', icon: 'bicycle', tone: 'enroute' };
      case 'ARRIVED': return { label: 'Arrived', icon: 'home', tone: 'arrived' };
      case 'IN_PROGRESS': return { label: 'In Progress', icon: 'construct', tone: 'enroute' };
      case 'CANCELLED': return { label: 'Cancelled', icon: 'close-circle', tone: 'cancelled' };
      case 'COMPLETED': return { label: 'Completed', icon: 'checkmark-circle', tone: 'arrived' };
      default: return { label: 'Pending', icon: 'time', tone: 'accepted' };
    }
  });

  readonly banner = computed(() => {
    const o = this.orders.order();
    const partnerName = this.auth.user()?.role === 'PRO' ? o.customerName : o.helper.name;
    if (this.orders.pendingAddon()) return `${partnerName} requested an add-on. Review it before work continues.`;
    switch (o.status) {
      case 'ACCEPTED': return `${partnerName.split(' ')[0]} accepted your booking and is getting ready.`;
      case 'EN_ROUTE': return `${partnerName.split(' ')[0]} is on the way for your service.`;
      case 'ARRIVED': return `${partnerName.split(' ')[0]} has arrived. Meet at ${o.address.landmark.split(' · ')[0]}.`;
      case 'IN_PROGRESS': return 'Work in progress. Inspect the result before sharing your PIN.';
      case 'CANCELLED': return 'This booking was cancelled and your escrow payment was refunded.';
      case 'COMPLETED': return 'Job complete and escrow released. Thanks for booking!';
      default: return '';
    }
  });

  ionViewDidEnter(): void {
    void this.orders.refresh();
    this.map?.refresh();
  }

  private readonly calls = inject(BookingCallService);
  call(): Promise<void> {
    return this.calls.call(this.orders.order().id);
  }

  async cancel(): Promise<void> {
    const fees = this.community.cancellationFees();
    if (!fees) return;
    const alert = await this.alerts.create({ header: 'Cancel booking?',
      message: `Before departure: full refund. En route: ${formatPhp(fees.enRouteCentavos / 100)} trip fee. After arrival: ${formatPhp(fees.arrivedCentavos / 100)} visit fee. Eligible late no-shows are free. The server checks the final fee and refund. In-progress cancellations require a dispute.`,
      inputs: [{ name: 'reason', type: 'text', placeholder: 'Reason for cancellation', attributes: { maxlength: 500 } }],
      buttons: [{ text: 'Keep booking', role: 'cancel' }, { text: 'Cancel booking', handler: (data) => {
        if (!data.reason?.trim() || this.cancelling()) return false;
        this.cancelling.set(true);
        void this.orders.cancel(data.reason.trim()).catch(() => undefined).finally(() => this.cancelling.set(false));
        return true;
      } }],
    });
    await alert.present();
  }

  replay(): void {
    this.sim.replay();
  }

  resetDemo(): void {
    void this.orders.resetDemo().catch(() => undefined);
  }
}
