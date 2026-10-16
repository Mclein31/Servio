import { TrackingControlsComponent } from '../../../shared/components/tracking-controls/tracking-controls.component';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ActionSheetController, AlertController, IonContent, IonFooter, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular';
import { OrderService } from '../../../core/services/order.service';
import { TrackingService } from '../../../core/services/tracking.service';
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
  imports: [TrackingControlsComponent,IonHeader, IonToolbar, IonTitle, IonContent, IonFooter, IonIcon, RouterLink, AvatarComponent, StepperComponent, PhpPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobExecutePage {
  readonly orders = inject(OrderService);
  readonly sim = inject(TrackingService);
  private readonly router = inject(Router);
  private readonly sheets = inject(ActionSheetController);
  private readonly alerts = inject(AlertController);

  readonly saving = signal(false);
  readonly error = signal('');
  readonly steps = computed(() => buildMilestones(STEP_INDEX[this.orders.order().status] ?? 0, PRO_STEPS));

  /** Status-advance state machine: ACCEPTED → EN_ROUTE → ARRIVED → IN_PROGRESS → (PIN) COMPLETED. */
  readonly action = computed<StatusAction>(() => {
    const id = this.orders.order().id;
    switch (this.orders.order().status) {
      case 'PENDING_ACCEPTANCE': return { label: 'Back to offers', hint: 'Accept the offer before starting.', route: ['/pro'] };
      case 'ACCEPTED': return { label: 'Tap When En Route', hint: 'You’re assigned. Leave when you’re ready.', next: 'EN_ROUTE' };
      case 'EN_ROUTE': return { label: 'Tap When Arrived On-Site', hint: 'The customer sees your live location and ETA.', next: 'ARRIVED' };
      case 'ARRIVED': return { label: 'Start Working', hint: 'Confirm the scope with the customer first.', next: 'IN_PROGRESS' };
      case 'IN_PROGRESS': return { label: 'Work Finished — Request Customer OTP', hint: 'Finish the agreed work before asking for the PIN.', route: ['/pro/order', id, 'verify-otp'] };
      case 'COMPLETED': return { label: 'View Wallet', hint: 'Escrow released to your wallet.', route: ['/pro/wallet'] };
      default: return { label: 'Back to radar', hint: 'This order was cancelled.', route: ['/pro'] };
    }
  });

  readonly canAddOn = computed(() => ['ARRIVED', 'IN_PROGRESS'].includes(this.orders.order().status));

  async advance(): Promise<void> {
    const a = this.action();
    if (a.next) {
      if (this.saving()) return; this.saving.set(true); this.error.set('');
      try { await this.orders.advance(a.next); navigator.vibrate?.(12); }
      catch (error) { this.error.set(error instanceof Error ? error.message : 'Could not change status.'); }
      finally { this.saving.set(false); }
    } else if (a.route) {
      this.router.navigate(a.route);
    }
  }

  async cancel(): Promise<void> {
    const alert = await this.alerts.create({ header: 'Cancel this job?', message: 'The customer receives a full refund. A cancellation strike is recorded on your Pro profile.',
      inputs: [{ name: 'reason', type: 'text', placeholder: 'Reason', attributes: { maxlength: 500 } }],
      buttons: [{ text: 'Keep job', role: 'cancel' }, { text: 'Cancel job', handler: (data) => {
        if (!data.reason?.trim() || this.saving()) return false;
        this.saving.set(true);
        void this.orders.cancel(data.reason.trim()).catch((error) => this.error.set(error instanceof Error ? error.message : 'Could not cancel job.')).finally(() => this.saving.set(false));
        return true;
      } }],
    }); await alert.present();
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
      message: 'Voice calls are not available in this demo. Use the booking chat.',
      buttons: [{ text: 'End call', role: 'cancel' }],
    });
    await a.present();
  }

  private openExternal(url: string): void {
    window.open(url, '_blank', 'noopener');
  }
}
