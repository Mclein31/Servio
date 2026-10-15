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

  submit(): void {
    if (this.pin().length !== 4) return;
    const payout = this.orders.proPayoutPhp();
    if (this.orders.verifyCompletionPin(this.pin())) {
      navigator.vibrate?.([20, 40, 20]);
      this.credited.set(payout);
    } else {
      this.error.set(true);
      setTimeout(() => this.error.set(false), 400);
      this.codeInput?.clear();
    }
  }

  /** Simulated QR scan: a real build would use a barcode-scanner plugin; the token carries the PIN. */
  scan(): void {
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
