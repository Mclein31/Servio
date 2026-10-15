import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ActionSheetController, AlertController, IonContent, IonFooter, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular';
import { OrderService } from '../../../core/services/order.service';
import { TrackingSimService } from '../../../core/services/tracking-sim.service';
import { OrderStatus } from '../../../shared/models/domain.models';
import { buildMilestones } from '../../../shared/models/ui.models';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { StepperComponent } from '../../../shared/components/stepper/stepper.component';
import { PhpPipe } from '../../../shared/pipes/php.pipe';

interface StatusAction {
  label: string;
  hint: string;
  next?: OrderStatus;
  route?: string[];
}

const PRO_STEPS = ['Accepted', 'En Route', 'Arrived', 'Working', 'Paid'];
const STEP_INDEX: Partial<Record<OrderStatus, number>> = { ACCEPTED: 0, EN_ROUTE: 1, ARRIVED: 2, IN_PROGRESS: 3, COMPLETED: 4 };

@Component({
  selector: 'app-job-execute',
  templateUrl: 'job-execute.page.html',
  styleUrl: 'job-execute.page.scss',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonFooter, IonIcon, RouterLink, AvatarComponent, StepperComponent, PhpPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobExecutePage {
  readonly orders = inject(OrderService);
  readonly sim = inject(TrackingSimService);
  private readonly router = inject(Router);
  private readonly sheets = inject(ActionSheetController);
  private readonly alerts = inject(AlertController);

  readonly steps = computed(() => buildMilestones(STEP_INDEX[this.orders.order().status] ?? 0, PRO_STEPS));

  /** Status-advance state machine: ACCEPTED → EN_ROUTE → ARRIVED → IN_PROGRESS → (PIN) COMPLETED. */
  readonly action = computed<StatusAction>(() => {
    const id = this.orders.order().id;
    switch (this.orders.order().status) {
      case 'PENDING_ACCEPTANCE':
      case 'ACCEPTED': return { label: 'Tap When En Route', hint: 'You’re assigned. Leave when you’re ready.', next: 'EN_ROUTE' };
      case 'EN_ROUTE': return { label: 'Tap When Arrived On-Site', hint: 'The customer sees your live location and ETA.', next: 'ARRIVED' };
      case 'ARRIVED': return { label: 'Start Working', hint: 'Confirm the scope with the customer first.', next: 'IN_PROGRESS' };
      case 'IN_PROGRESS': return { label: 'Work Finished — Request Customer OTP', hint: 'Finish the agreed work before asking for the PIN.', route: ['/pro/order', id, 'verify-otp'] };
      case 'COMPLETED': return { label: 'View Wallet', hint: 'Escrow released to your wallet.', route: ['/pro/wallet'] };
      default: return { label: 'Back to radar', hint: 'This order was cancelled.', route: ['/pro'] };
    }
  });

  readonly canAddOn = computed(() => ['ARRIVED', 'IN_PROGRESS'].includes(this.orders.order().status));

  advance(): void {
    const a = this.action();
    if (a.next) {
      this.orders.setStatus(a.next);
      navigator.vibrate?.(12);
    } else if (a.route) {
      this.router.navigate(a.route);
    }
  }

  async navigate(): Promise<void> {
    const [lat, lng] = this.sim.destination;
    const sheet = await this.sheets.create({
      header: 'Open navigation',
      subHeader: this.orders.order().address.street,
      buttons: [
        { text: 'Waze', handler: () => this.openExternal(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`) },
        { text: 'Google Maps', handler: () => this.openExternal(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`) },
        { text: 'Other map app', handler: () => this.openExternal(`geo:${lat},${lng}?q=${lat},${lng}`) },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  async call(): Promise<void> {
    const a = await this.alerts.create({
      header: 'Masked call',
      subHeader: `Calling ${this.orders.order().customerName}`,
      message: 'Numbers stay private on both sides.',
      buttons: [{ text: 'End call', role: 'cancel' }],
    });
    await a.present();
  }

  private openExternal(url: string): void {
    window.open(url, '_blank', 'noopener');
  }
}
