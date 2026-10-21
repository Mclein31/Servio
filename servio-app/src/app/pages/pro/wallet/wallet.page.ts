// pro wallet page
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonHeader, IonIcon, IonModal, IonTitle, IonToolbar, ToastController } from '@ionic/angular';
import { formatPhLocal, PH_MOBILE_PATTERN } from '../../../core/services/auth.service';
import { INSTAPAY_FEE_PHP, MIN_CASHOUT_PHP, WalletService } from '../../../core/services/wallet.service';
import { PhpPipe } from '../../../shared/pipes/php.pipe';

@Component({
  selector: 'app-wallet',
  templateUrl: 'wallet.page.html',
  styleUrl: 'wallet.page.scss',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonModal, RouterLink, PhpPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalletPage {
  readonly wallet = inject(WalletService);
  private readonly toasts = inject(ToastController);

  readonly saving = signal(false);
  ionViewWillEnter(): void { void this.wallet.refresh(); }
  readonly minCashout = MIN_CASHOUT_PHP;
  readonly fee = INSTAPAY_FEE_PHP;
  readonly cashoutOpen = signal(false);
  readonly amount = signal(MIN_CASHOUT_PHP * 4);
  readonly gcash = signal('9171234567');
  readonly gcashDisplay = computed(() => formatPhLocal(this.gcash()));
  readonly error = signal<string | null>(null);

  readonly amountValid = computed(() => this.amount() >= MIN_CASHOUT_PHP && this.amount() + INSTAPAY_FEE_PHP <= this.wallet.availablePhp());
  readonly numberValid = computed(() => PH_MOBILE_PATTERN.test(this.gcash()));

  onAmount(event: Event): void {
    const v = parseFloat((event.target as HTMLInputElement).value);
    this.amount.set(Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);
  }

  onNumber(event: Event): void {
    const el = event.target as HTMLInputElement;
    const digits = el.value.replace(/\D/g, '').replace(/^0/, '').slice(0, 10);
    this.gcash.set(digits);
    el.value = formatPhLocal(digits);
  }

  setMax(): void {
    this.amount.set(Math.max(0, Math.floor((this.wallet.availablePhp() - INSTAPAY_FEE_PHP) * 100) / 100));
  }

  async confirm(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    const err = await this.wallet.cashout(this.amount(), this.gcash());
    this.saving.set(false);
    this.error.set(err);
    if (err) return;
    this.cashoutOpen.set(false);
    const t = await this.toasts.create({ message: `₱${this.amount().toLocaleString('en-PH', { minimumFractionDigits: 2 })} mock cashout recorded for GCash.`, duration: 2200, position: 'top', color: 'success' });
    await t.present();
  }
}
