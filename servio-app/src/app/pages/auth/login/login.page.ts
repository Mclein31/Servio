import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonFooter, IonIcon, IonSpinner } from '@ionic/angular';
import { AuthService, formatPhLocal, PH_MOBILE_PATTERN } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: 'login.page.html',
  styleUrl: 'login.page.scss',
  imports: [IonContent, IonFooter, IonIcon, IonSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly digits = signal('');
  readonly sending = signal(false);
  readonly display = computed(() => formatPhLocal(this.digits()));
  readonly valid = computed(() => PH_MOBILE_PATTERN.test(this.digits()));
  readonly showHint = computed(() => this.digits().length > 0 && !this.digits().startsWith('9'));

  onInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    let digits = el.value.replace(/\D/g, '');
    // Accept pasted local formats (09…) and international (+63 9…).
    if (digits.startsWith('63') && digits.length > 10) digits = digits.slice(2);
    if (digits.startsWith('0') && digits.length > 1) digits = digits.slice(1);
    digits = digits.slice(0, 10);
    this.digits.set(digits);
    const formatted = formatPhLocal(digits);
    if (el.value !== formatted) el.value = formatted;
  }

  async submit(): Promise<void> {
    if (!this.valid() || this.sending()) return;
    this.sending.set(true);
    const phone = `+63${this.digits()}`;
    try {
      await this.auth.sendOtp(phone);
      await this.router.navigate(['/auth/verify-otp'], { queryParams: { phone } });
    } finally {
      this.sending.set(false);
    }
  }
}
