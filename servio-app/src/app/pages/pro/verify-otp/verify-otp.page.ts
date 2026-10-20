import { AfterViewInit, ChangeDetectionStrategy, Component, ViewChild, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, IonFooter, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular';
import { OrderService } from '../../../core/services/order.service';
import { CodeInputComponent } from '../../../shared/components/code-input/code-input.component';
import { PhpPipe } from '../../../shared/pipes/php.pipe';

@Component({
  selector: 'app-pro-verify-otp',
  templateUrl: 'verify-otp.page.html',
  styleUrl: 'verify-otp.page.scss',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonFooter, IonIcon, CodeInputComponent, PhpPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProVerifyOtpPage implements AfterViewInit {
  @ViewChild(CodeInputComponent) codeInput?: CodeInputComponent;

  readonly orders = inject(OrderService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly saving = signal(false);
  readonly message = signal('');
  readonly locked = signal(false);
  readonly pin = signal('');
  readonly error = signal(false);
  readonly scanning = signal(false);
  readonly credited = signal<number | null>(this.orders.order().escrow === 'COMPLETED' ? this.orders.proPayoutPhp() : null);

  ngAfterViewInit(): void {
    if (this.credited() === null) this.codeInput?.focusFirst();
  }

  back(): void {
    this.location.back();
  }

  async submit(): Promise<void> {
    if (this.pin().length !== 4 || this.saving() || this.locked()) return;
    this.saving.set(true); this.message.set('');
    try {
    const payout = this.orders.proPayoutPhp();
    if (await this.orders.complete(this.pin())) {
      navigator.vibrate?.([20, 40, 20]);
      this.credited.set(payout);
    } else {
      this.error.set(true);
      setTimeout(() => this.error.set(false), 400);
      this.codeInput?.clear();
    }
    } catch (error) { this.error.set(true); this.codeInput?.clear(); this.message.set(error instanceof Error ? error.message : 'Could not verify the PIN.'); if ((error as { status?: number }).status === 423) this.locked.set(true); }
    finally { this.saving.set(false); }
  }

  scan(): void {
    if (!this.orders.api.settings.useMockApi()) return;
    this.scanning.set(true);
    setTimeout(() => {
      this.scanning.set(false);
      this.pin.set(this.orders.order().completionPin);
      this.submit();
    }, 1600);
  }

  viewWallet(): void {
    this.router.navigateByUrl('/pro/wallet', { replaceUrl: true });
  }
}
