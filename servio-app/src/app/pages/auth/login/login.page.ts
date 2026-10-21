// login page
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonFooter, IonIcon, IonSpinner } from '@ionic/angular';
import { AuthService, EMAIL_PATTERN } from '../../../core/services/auth.service';
import { DemoConnectionService } from '../../../core/services/demo-connection.service';

@Component({
  selector: 'app-login', templateUrl: 'login.page.html', styleUrl: 'login.page.scss',
  imports: [IonContent, IonFooter, IonIcon, IonSpinner, RouterLink], changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  readonly auth = inject(AuthService);
  readonly connection = inject(DemoConnectionService);
  private readonly router = inject(Router);
  readonly email = signal('');
  readonly sending = signal(false);
  readonly error = signal('');
  readonly valid = computed(() => EMAIL_PATTERN.test(this.email().trim()) && this.email().trim().length <= 255);
  readonly showHint = computed(() => !!this.email() && !this.valid());
  onInput(event: Event): void { this.email.set((event.target as HTMLInputElement).value); this.error.set(''); }
  async submit(): Promise<void> {
    if (!this.valid() || this.sending()) return;
    this.sending.set(true); this.error.set('');
    try {
      const email = this.email().trim().toLowerCase();
      await this.auth.sendOtp(email);
      await this.router.navigate(['/auth/verify-otp'], { queryParams: { email } });
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Could not request a code. Try again.'); }
    finally { this.sending.set(false); }
  }
}
