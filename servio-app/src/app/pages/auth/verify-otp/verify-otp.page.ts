// otp page
import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonHeader, IonIcon, IonSpinner, IonToolbar } from '@ionic/angular';
import { AuthService, TEST_OTP } from '../../../core/services/auth.service';
import { CodeInputComponent } from '../../../shared/components/code-input/code-input.component';

const RESEND_SECONDS = 60;

@Component({
  selector: 'app-verify-otp',
  templateUrl: 'verify-otp.page.html',
  styleUrl: 'verify-otp.page.scss',
  imports: [IonHeader, IonToolbar, IonContent, IonIcon, IonSpinner, CodeInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyOtpPage implements AfterViewInit {
  @ViewChild(CodeInputComponent) codeInput?: CodeInputComponent;

  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly email: string;
  readonly testCode = TEST_OTP;
  readonly remaining = signal(RESEND_SECONDS);
  readonly verifying = signal(false);
  readonly error = signal(false);
  readonly countdown = computed(() => {
    const s = this.remaining();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.email = inject(ActivatedRoute).snapshot.queryParamMap.get('email') ?? this.auth.pendingEmail() ?? '';
    this.startTimer();
    inject(DestroyRef).onDestroy(() => this.stopTimer());
  }

  ngAfterViewInit(): void {
    this.codeInput?.focusFirst();
  }

  back(): void {
    this.router.navigateByUrl('/auth/login');
  }

  async verify(code: string): Promise<void> {
    if (this.verifying()) return;
    this.error.set(false);
    this.verifying.set(true);
    try {
      const ok = await this.auth.verifyOtp(this.email, code);
      if (ok) {
        this.stopTimer();
        await this.router.navigateByUrl(this.auth.landingPath(), { replaceUrl: true });
      } else { this.error.set(true); this.codeInput?.clear(); }
    } catch { this.error.set(true); this.codeInput?.clear(); }
    finally { this.verifying.set(false); }
  }

  async resend(): Promise<void> {
    try { await this.auth.sendOtp(this.email); this.codeInput?.clear(); this.startTimer(); }
    catch { this.error.set(true); }
  }

  private startTimer(): void {
    this.stopTimer();
    this.remaining.set(RESEND_SECONDS);
    this.timer = setInterval(() => {
      this.remaining.update((s) => Math.max(0, s - 1));
      if (this.remaining() === 0) this.stopTimer();
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
