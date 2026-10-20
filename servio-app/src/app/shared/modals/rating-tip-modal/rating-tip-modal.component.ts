import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonFooter, IonHeader, IonIcon, IonTitle, IonToolbar, ToastController } from '@ionic/angular';
import { OrderService } from '../../../core/services/order.service';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { PhpPipe } from '../../pipes/php.pipe';
import { roundCentavos } from '../../utils/money';

type TipChoice = 0 | 50 | 100 | 200 | 'custom';
const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

@Component({
  selector: 'app-rating-tip-modal',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonFooter, IonIcon, AvatarComponent, PhpPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let o = orders.order();
    <ion-header class="ion-no-border">
      <ion-toolbar class="servio-detail-bar">
        <button type="button" class="icon-btn" slot="start" (click)="close()" aria-label="Close">
          <ion-icon name="close" aria-hidden="true"></ion-icon>
        </button>
        <ion-title>Rate Your Experience</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="servio-page">
      <div class="wrap">
        @if (error()) { <p role="alert">{{ error() }}</p> }
        <div class="who">
          <app-avatar [src]="o.helper.avatarUrl" [name]="o.helper.name" [size]="72"></app-avatar>
          <h1>How was your service with {{ o.helper.name }}?</h1>
          <span class="servio-caption">{{ o.sku.name }} · #{{ o.code ?? o.id }}</span>
        </div>

        <div class="stars" role="radiogroup" aria-label="Rating">
          @for (s of [1, 2, 3, 4, 5]; track s) {
            <button type="button" role="radio" [attr.aria-checked]="rating() === s" [attr.aria-label]="s + ' star' + (s > 1 ? 's' : '')"
              [class.on]="s <= rating()" [class.bump]="bumped() === s" (click)="rate(s)">
              <ion-icon [name]="s <= rating() ? 'star' : 'star-outline'" aria-hidden="true"></ion-icon>
            </button>
          }
        </div>
        <p class="word">{{ ratingWord() }}</p>

        <h2>What went well?</h2>
        <div class="chips">
          @for (c of compliments; track c) {
            <button type="button" class="chip" [class.active]="picked().has(c)" [attr.aria-pressed]="picked().has(c)" (click)="togglePick(c)">{{ c }}</button>
          }
        </div>

        <label class="feedback">
          <span>Your review <em>(optional)</em></span>
          <textarea rows="3" placeholder="Share details that help your neighbors choose." (input)="feedback.set($any($event.target).value)"></textarea>
        </label>

        <h2>Say thanks with a tip</h2>
        <div class="chips">
          @for (t of tipChoices; track t) {
            <button type="button" class="chip" [class.active]="tip() === t" [attr.aria-pressed]="tip() === t" (click)="tip.set(t)">
              {{ t === 0 ? 'No Tip' : t === 'custom' ? 'Custom' : '₱' + t }}
            </button>
          }
        </div>
        @if (tip() === 'custom') {
          <label class="custom">
            <span>₱</span>
            <input type="number" inputmode="decimal" min="0" max="5000" placeholder="Amount" (input)="custom.set(+$any($event.target).value || 0)" aria-label="Custom tip in pesos" />
          </label>
        }
        <p class="servio-caption tip-note">100% of your tip goes directly to your helper.</p>

        <section class="receipt servio-card" aria-label="Receipt summary">
          <div class="line"><span>Service · {{ o.sku.name }}</span><span class="price">{{ o.sku.pricePhp | php }}</span></div>
          @if (orders.approvedAddonsPhp() > 0) {
            <div class="line"><span>Approved add-ons</span><span class="price">{{ orders.approvedAddonsPhp() | php }}</span></div>
          }
          <div class="line"><span>Trust & Safety Fee</span><span class="price">{{ o.trustFeePhp | php }}</span></div>
          <div class="line tip"><span>Tip for {{ o.helper.name }}</span><span class="price">{{ tipPhp() | php }}</span></div>
          <div class="divider"></div>
          <div class="line total"><span>Total paid</span><span class="price">{{ totalPhp() | php }}</span></div>
        </section>
      </div>
    </ion-content>

    <ion-footer class="ion-no-border">
      <div class="servio-action-bar">
        <button type="button" class="pill-btn block" [disabled]="rating() === 0 || saving() || orders.order().reviewed" (click)="submit()">Submit Review & Close</button>
      </div>
    </ion-footer>
  `,
  styleUrl: './rating-tip-modal.component.scss',
})
export class RatingTipModalComponent {
  readonly orders = inject(OrderService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastController);

  readonly compliments = ['Punctual', 'Clean Work', 'Polite', 'Expert Knowledge'];
  readonly tipChoices: TipChoice[] = [0, 50, 100, 200, 'custom'];

  readonly saving = signal(false);
  readonly error = signal('');
  readonly rating = signal(5);
  readonly bumped = signal(0);
  readonly picked = signal(new Set<string>(['Clean Work']));
  readonly feedback = signal('');
  readonly tip = signal<TipChoice>(100);
  readonly custom = signal(0);

  readonly ratingWord = computed(() => (this.rating() ? `${RATING_WORDS[this.rating()]} · ${this.rating()} out of 5` : 'Tap a star to rate'));
  readonly tipPhp = computed(() => {
    const t = this.tip();
    return roundCentavos(t === 'custom' ? Math.min(5000, Math.max(0, this.custom())) : t);
  });
  readonly totalPhp = computed(() => roundCentavos(this.orders.escrowTotalPhp() + this.tipPhp()));

  rate(s: number): void {
    this.rating.set(s);
    this.bumped.set(s);
    setTimeout(() => this.bumped.set(0), 300);
    navigator.vibrate?.(8);
  }

  togglePick(c: string): void {
    this.picked.update((set) => {
      const next = new Set(set);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  async submit(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true); this.error.set('');
    try { await this.orders.review(this.rating(), [...this.picked()], this.feedback(), this.tipPhp()); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Could not submit review.'); return; }
    finally { this.saving.set(false); }
    const toast = await this.toasts.create({
      message: this.tipPhp() > 0 ? `Thanks! ₱${this.tipPhp()} tip sent to ${this.orders.order().helper.name}.` : 'Thanks for your review!',
      duration: 2000,
      position: 'top',
      color: 'success',
    });
    await toast.present();
    this.router.navigateByUrl('/tabs/home', { replaceUrl: true });
  }

  close(): void {
    this.router.navigateByUrl('/tabs/tracking');
  }
}
