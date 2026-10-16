import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { IonContent, IonFooter, IonHeader, IonIcon, IonSelect, IonSelectOption, IonSpinner, IonTitle, IonToolbar, ToastController } from '@ionic/angular';
import { CommunityService } from '../../../core/services/community.service';
import { OrderService } from '../../../core/services/order.service';
import { AddonSku } from '../../../shared/models/domain.models';
import { PhpPipe } from '../../../shared/pipes/php.pipe';
import { formatPhp, splitPayout } from '../../../shared/utils/money';

const SAMPLE_EVIDENCE = 'assets/design/sample-drain-hose-evidence.png';

@Component({
  selector: 'app-add-quote',
  templateUrl: 'add-quote.page.html',
  styleUrl: 'add-quote.page.scss',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonFooter, IonIcon, IonSelect, IonSelectOption, IonSpinner, PhpPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddQuotePage {
  private readonly orders = inject(OrderService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly toasts = inject(ToastController);

  readonly community = inject(CommunityService);
  readonly catalog = this.community.addons;
  readonly saving = signal(false);
  readonly error = signal('');
  readonly demo = environment.demo;
  async ionViewWillEnter(): Promise<void> { try { await this.community.catalog(); this.partId.set(this.catalog()[0]?.id ?? ''); } catch { this.error.set('Could not load the add-on catalog.'); } }
  readonly partId = signal('');
  readonly photo = signal<string | null>(null);
  readonly capturing = signal(false);
  readonly note = signal('Exposed drain hose is cracked and causing wall moisture.');

  readonly part = computed<AddonSku | null>(() => this.catalog().find((p) => p.id === this.partId()) ?? this.catalog()[0] ?? null);
  /** 85% / 15% split of the add-on (e.g. ₱350 → ₱297.50 Pro / ₱52.50 platform). */
  readonly split = computed(() => splitPayout(this.part()?.pricePhp ?? 0));
  readonly canSubmit = computed(() => !!this.photo() && !!this.part() && this.note().trim().length >= 10 && !this.saving());

  optionLabel(name: string, price: number): string {
    return `${name} — ${formatPhp(price)}`;
  }

  back(): void {
    this.location.back();
  }

  async capture(): Promise<void> {
    this.capturing.set(true);
    try {
      const shot = await Camera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.DataUrl,
        quality: 70,
        width: 1280,
        correctOrientation: true,
        webUseInput: true,
      });
      if (shot.dataUrl) this.photo.set(shot.dataUrl);
    } catch (err) {
      // Cancelled, permission denied, or no camera (desktop browser).
      if (!String(err).toLowerCase().includes('cancel')) {
        const t = await this.toasts.create({ message: 'Camera unavailable here — attach the sample evidence photo instead.', duration: 2200, position: 'top' });
        await t.present();
      }
    } finally {
      this.capturing.set(false);
    }
  }

  useSample(): void {
    this.photo.set(SAMPLE_EVIDENCE);
  }

  retake(): void {
    this.photo.set(null);
    this.capture();
  }

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    const o = this.orders.order();
    this.saving.set(true); this.error.set('');
    try { await this.orders.quote(this.part()!, this.photo()!, this.note().trim()); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Could not send quote.'); return; }
    finally { this.saving.set(false); }
    const t = await this.toasts.create({ message: `Quote sent to ${o.customerName}. Waiting for approval.`, duration: 2000, position: 'top', color: 'success' });
    await t.present();
    this.router.navigate(['/pro/order', o.id, 'execute'], { replaceUrl: true });
  }
}
