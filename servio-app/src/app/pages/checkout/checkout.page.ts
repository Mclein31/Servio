import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonFooter, IonHeader, IonIcon, IonTitle, IonToolbar, ToastController } from '@ionic/angular';
import { HELPERS, SKUS } from '../../core/data/mock-data';
import { OrderService } from '../../core/services/order.service';
import { PaymentMethod } from '../../shared/models/domain.models';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { SlideToConfirmComponent } from '../../shared/components/slide-to-confirm/slide-to-confirm.component';
import { PhpPipe } from '../../shared/pipes/php.pipe';
import { roundCentavos } from '../../shared/utils/money';

const TRUST_FEE_PHP = 50;

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
  private readonly toasts = inject(ToastController);

  readonly helper;
  readonly sku;
  readonly schedules = ['Immediate / ASAP', 'Today (2:00 PM - 4:00 PM)', 'Tomorrow Morning'];
  readonly schedule = signal(this.schedules[0]);
  readonly payment = signal<PaymentMethod>('GCASH');
  readonly address = this.orders.order().address;

  readonly feePhp = TRUST_FEE_PHP;
  readonly totalPhp = computed(() => roundCentavos(this.sku.pricePhp + TRUST_FEE_PHP));

  constructor() {
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    const helper = HELPERS.find((h) => h.id === q.get('helper')) ?? HELPERS.find((h) => h.id === 'daniel')!;
    this.helper = helper;
    this.sku = helper.skus.find((s) => s.id === q.get('sku')) ?? (helper.id === 'daniel' ? SKUS['acLeak'] : helper.skus[0]);
  }

  back(): void {
    this.location.back();
  }

  async changeAddress(): Promise<void> {
    const t = await this.toasts.create({ message: 'Saved addresses arrive with the address book. Using 42 Jupiter Street.', duration: 1800, position: 'top' });
    await t.present();
  }

  authorize(): void {
    this.orders.book(this.payment(), this.schedule(), this.sku, this.helper);
    this.router.navigateByUrl('/tabs/tracking', { replaceUrl: true });
    // Demo dispatch: the Pro leaves shortly after accepting. In production this is driven by the Pro app.
    setTimeout(() => {
      if (this.orders.order().status === 'ACCEPTED') this.orders.setStatus('EN_ROUTE');
    }, 3500);
  }
}
