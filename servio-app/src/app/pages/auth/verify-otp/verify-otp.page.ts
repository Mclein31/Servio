import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonHeader, IonIcon, IonSpinner, IonToolbar } from '@ionic/angular';
import { AuthService, formatPhLocal, TEST_OTP } from '../../../core/services/auth.service';
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

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly phone: string;
  readonly displayPhone: string;
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
    const raw = inject(ActivatedRoute).snapshot.queryParamMap.get('phone') ?? this.auth.pendingPhone() ?? '';
    this.phone = raw.startsWith('+63') ? raw : `+63${raw.replace(/\D/g, '')}`;
    this.displayPhone = `+63 ${formatPhLocal(this.phone.slice(3))}`;
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
    const ok = await this.auth.verifyOtp(this.phone, code);
    this.verifying.set(false);
    if (ok) {
      this.stopTimer();
      this.router.navigateByUrl('/tabs/home', { replaceUrl: true });
    } else {
      this.error.set(true);
      this.codeInput?.clear();
    }
  }

  async resend(): Promise<void> {
    await this.auth.sendOtp(this.phone);
    this.codeInput?.clear();
    this.startTimer();
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
