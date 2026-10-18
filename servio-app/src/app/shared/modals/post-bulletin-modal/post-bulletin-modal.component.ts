import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToggle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { CATEGORIES } from '../../../core/data/mock-data';
import { CommunityService } from '../../../core/services/community.service';
import { AddressService } from '../../../core/services/address.service';
import { CategoryId } from '../../models/ui.models';
import { PhpPipe } from '../../pipes/php.pipe';
import { formatPhp } from '../../utils/money';

const MAX_DESC = 200;

@Component({
  selector: 'app-post-bulletin-modal',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonFooter, IonIcon, IonSelect, IonSelectOption, IonToggle, PhpPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar class="servio-detail-bar">
        <ion-title>Post Community Request</ion-title>
        <button type="button" class="icon-btn" slot="end" (click)="close()" aria-label="Cancel">
          <ion-icon name="close" aria-hidden="true"></ion-icon>
        </button>
      </ion-toolbar>
    </ion-header>

    <ion-content class="servio-page">
      <form class="wrap" (submit)="$event.preventDefault(); post()">
        @if (urgent()) {
          <div class="urgent-banner" role="status"><span class="bang">!</span> Marked urgent · shown first to nearby helpers</div>
        }

        @if (error()) { <p role="alert">{{ error() }}</p> }
        <fieldset>
          <legend>Category</legend>
          <div class="cats">
            @for (c of categories; track c.id) {
              <button type="button" class="cat" [class.active]="category() === c.id" [attr.aria-pressed]="category() === c.id" (click)="pickCategory(c.id)">
                <span class="well" [style.background]="c.tint" [style.color]="c.accent"><ion-icon [name]="c.icon" aria-hidden="true"></ion-icon></span>
                {{ c.shortLabel }}
              </button>
            }
          </div>
        </fieldset>

        <label class="field">
          <span class="label">Standardized service</span>
          <ion-select class="select" interface="action-sheet" [value]="skuId()" (ionChange)="skuId.set($any($event).detail.value)"
            [interfaceOptions]="{ header: 'Fixed-price catalog' }" aria-label="Standardized service">
            @for (s of skus(); track s.id) {
              <ion-select-option [value]="s.id">{{ s.name }} — {{ priceLabel(s.pricePhp, s.unit) }}</ion-select-option>
            }
          </ion-select>
          @if (sku(); as s) {
            <span class="rate">Standard rate <strong class="price">{{ s.pricePhp | php }}</strong> / {{ s.unit }} · {{ s.durationLabel }}</span>
          }
        </label>

        <label class="field">
          <span class="label">Details</span>
          <textarea rows="4" [maxLength]="maxDesc" placeholder="Describe what you need, access notes, brand or model…" (input)="desc.set($any($event.target).value)"></textarea>
          <span class="counter" [class.near]="desc().length > maxDesc - 20">{{ desc().length }}/{{ maxDesc }}</span>
        </label>

        <div class="toggle-row" [class.on]="urgent()">
          <span class="t-text"><span class="bang">!</span> Mark as Urgent</span>
          <ion-toggle [checked]="urgent()" (ionChange)="urgent.set($any($event).detail.checked)" aria-label="Mark as urgent"></ion-toggle>
        </div>

        <label class="field">
          <span class="label">Neighborhood</span>
          <span class="addr">
            <ion-icon name="location-outline" aria-hidden="true"></ion-icon>
            <input type="text" [value]="area()" (input)="area.set($any($event.target).value)" placeholder="Barangay or street" />
          </span>
          <span class="hint">{{ saved ? 'Your selected saved address supplies an approximate area pin. Exact entrance details stay in the booking.' : 'Add a pinned saved address to share an approximate area. No location will be shared for this post.' }}</span>
        </label>
      </form>
    </ion-content>

    <ion-footer class="ion-no-border">
      <div class="servio-action-bar">
        <button type="button" class="pill-btn block" [disabled]="!canPost()" (click)="post()">Post to Community Bulletin</button>
      </div>
    </ion-footer>
  `,
  styleUrl: './post-bulletin-modal.component.scss',
})
export class PostBulletinModalComponent {
  private readonly modals = inject(ModalController);
  private readonly toasts = inject(ToastController);

  readonly community = inject(CommunityService);
  readonly saving = signal(false);
  readonly error = signal('');
  constructor() { void this.community.catalog().then(() => this.pickCategory(this.category())).catch(() => this.error.set('Could not load catalog.')); }
  readonly maxDesc = MAX_DESC;
  readonly categories = CATEGORIES.filter((c) => c.id !== 'tech');
  readonly category = signal<CategoryId>('repairs');
  readonly skuId = signal('');
  readonly desc = signal('');
  readonly urgent = signal(false);
  readonly saved = inject(AddressService).selected();
  readonly area = signal(this.saved ? `${this.saved.barangay}, ${this.saved.city}` : 'Barangay Ugac Norte, Tuguegarao City');

  readonly skus = computed(() => this.community.skus().filter((s) => s.category === this.category()));
  readonly sku = computed(() => this.community.skus().find((s) => s.id === this.skuId()) ?? null);
  readonly canPost = computed(() => !!this.sku() && this.area().trim().length > 2 && this.desc().trim().length > 0 && !this.saving());

  pickCategory(id: CategoryId): void {
    this.category.set(id);
    this.skuId.set(this.skus()[0]?.id ?? '');
  }

  priceLabel(price: number, unit: string): string {
    return `${formatPhp(price, { whole: true })}${unit === 'job' ? '' : '/' + unit}`;
  }

  async post(): Promise<void> {
    if (!this.canPost()) return;
    this.saving.set(true); this.error.set('');
    try { await this.community.postRequest({ skuId: this.sku()!.id, categoryId: this.category(), description: this.desc().trim(), neighborhood: this.area().trim(), urgent: this.urgent(), ...(this.saved ? {lat:Number(this.saved.lat.toFixed(3)),lng:Number(this.saved.lng.toFixed(3))} : {}) }); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Could not post request.'); return; }
    finally { this.saving.set(false); }
    await this.modals.dismiss({ posted: true });
    const toast = await this.toasts.create({
      message: `Posted “${this.sku()!.name}” to your neighborhood${this.urgent() ? ' as urgent' : ''}.`,
      duration: 2200,
      position: 'top',
      color: 'success',
    });
    await toast.present();
  }

  close(): void {
    this.modals.dismiss();
  }
}
