import { ChangeDetectionStrategy, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { DecimalPipe, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonFooter, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular';
import { CommunityService } from '../../core/services/community.service';
import { AuthService } from '../../core/services/auth.service';
import { HelperProfile, ServiceSku } from '../../shared/models/domain.models';
import { OrderService } from '../../core/services/order.service';
import { PaymentMethod } from '../../shared/models/domain.models';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { SlideToConfirmComponent } from '../../shared/components/slide-to-confirm/slide-to-confirm.component';
import { PhpPipe } from '../../shared/pipes/php.pipe';
import { PaymentMethodsService } from '../../core/services/payment-methods.service';
import { AddressService } from '../../core/services/address.service';
import { roundCentavos } from '../../shared/utils/money';

/** Resolve Philippine calendar windows independently of the phone timezone. */
export function scheduleWindow(label: string, now = new Date()): { scheduleStartAt: string; scheduleEndAt: string } | undefined {
  if (label.startsWith('Immediate')) return undefined;
  const ph = new Date(now.getTime() + 8 * 3600000);
  const tomorrow = label.startsWith('Tomorrow');
  const start = Date.UTC(ph.getUTCFullYear(), ph.getUTCMonth(), ph.getUTCDate() + (tomorrow ? 1 : 0), (tomorrow ? 9 : 14) - 8);
  const end = start + (tomorrow ? 3 : 2) * 3600000;
  return { scheduleStartAt: new Date(start).toISOString(), scheduleEndAt: new Date(end).toISOString() };
}

@Component({
  selector: 'app-checkout',
  templateUrl: 'checkout.page.html',
  styleUrl: 'checkout.page.scss',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonFooter, IonIcon, DecimalPipe, AvatarComponent, SlideToConfirmComponent, PhpPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutPage {
  private readonly orders = inject(OrderService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly paymentMethods = inject(PaymentMethodsService);
  readonly addresses = inject(AddressService);
  readonly auth = inject(AuthService);

  @ViewChild(SlideToConfirmComponent) slide?: SlideToConfirmComponent;
  readonly community = inject(CommunityService);
  readonly helper = signal<HelperProfile | null>(null);
  readonly sku = signal<ServiceSku | null>(null);
  readonly saving = signal(false);
  readonly error = signal('');
  private attempt?: { fingerprint: string; key: string };
  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;
  readonly bulletinId = this.query.get('bulletin') ?? undefined;
  readonly schedules = ['Immediate / ASAP', 'Today (2:00 PM - 4:00 PM)', 'Tomorrow Morning'];
  readonly schedule = signal(this.schedules[0]);
  readonly payment = signal<PaymentMethod>('GCASH');
  private paymentInitialized = false;
  readonly address = this.addresses.selected;

  readonly isOwnHelper = computed(() => {
    const u = this.auth.user();
    const h = this.helper();
    if (!u || !h) return false;
    if (u.id === h.id) return true;
    return this.auth.settings.useMockApi() && !!u.fullName && u.fullName === h.name;
  });

  readonly feePhp = this.community.trustFeePhp;
  readonly totalPhp = computed(() => roundCentavos((this.sku()?.pricePhp ?? 0) + this.feePhp()));

  async ionViewWillEnter(): Promise<void> {
    this.sku.set(null); this.helper.set(null); this.error.set('');
    try {
      await Promise.all([this.community.catalog(), this.community.directory(this.query.get('helper') ?? undefined), this.addresses.refresh(), this.paymentMethods.refresh()]);
      if (!this.paymentInitialized) { this.payment.set(this.paymentMethods.preferred()); this.paymentInitialized = true; }
      const helper = this.community.helpers().find((h) => h.id === this.query.get('helper'));
      if (this.query.has('helper') && !helper) throw new Error('This helper is no longer available. Choose another helper.');
      if (this.bulletinId) {
        const { request } = await this.community.api.get<{ request: { authorId: string; skuId: string; acceptedProId: string | null; bookingId: string | null; status: string } }>(`/bulletin/${this.bulletinId}`);
        if (request.authorId !== this.auth.user()?.id || request.status !== 'ACCEPTED' || request.bookingId || request.acceptedProId !== helper?.id || request.skuId !== this.query.get('sku')) {
          throw new Error('This request has changed. Reopen the bulletin before confirming.');
        }
      }
      this.helper.set(helper ?? null);
      const sku = (helper?.skus ?? this.community.skus()).find((s) => s.id === this.query.get('sku')) ?? (helper?.skus ?? this.community.skus())[0];
      if (!sku) throw new Error('No catalog services are available yet.');
      this.sku.set(sku);
      if (this.isOwnHelper()) {
        this.error.set('You cannot book your own service.');
      }
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Could not load checkout.'); }
  }

  back(): void {
    this.location.back();
  }

  async changeAddress(): Promise<void> {
    await this.router.navigate(['/addresses'], { queryParams: { choose: '1' } });
  }

  async authorize(): Promise<void> {
    if (this.saving() || !this.sku()) return;
    if (this.isOwnHelper()) {
      this.error.set('You cannot book your own service.');
      this.slide?.reset();
      return;
    }
    if (!this.address()) { this.error.set('Choose and confirm your service address first.'); this.slide?.reset(); return; }
    this.saving.set(true); this.error.set('');
    const window = scheduleWindow(this.schedule());
    const fingerprint = JSON.stringify([this.payment(), this.schedule(), this.sku()?.id, this.helper()?.id, window, this.address(), this.bulletinId]);
    if (this.attempt?.fingerprint !== fingerprint) this.attempt = { fingerprint, key: crypto.randomUUID() };
    try {
      await this.orders.book(this.payment(), this.schedule(), this.sku()!, this.helper() ?? undefined, this.attempt.key, window, this.address()!, this.bulletinId);
      await this.router.navigateByUrl('/tabs/tracking', { replaceUrl: true });
      if (this.community.api.settings.useMockApi()) setTimeout(() => {
        if (this.community.api.settings.useMockApi() && this.orders.order().status === 'ACCEPTED') this.orders.setStatus('EN_ROUTE');
      }, 3500);
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Could not authorize booking.'); this.slide?.reset(); }
    finally { this.saving.set(false); }
  }
}
