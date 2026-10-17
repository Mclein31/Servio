import { ChangeDetectionStrategy, Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, IonFooter, IonIcon, ModalController } from '@ionic/angular';
import { CommunityService } from '../../../core/services/community.service';
import { AuthService } from '../../../core/services/auth.service';
import { HelperProfile, ServiceSku } from '../../models/domain.models';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { PhpPipe } from '../../pipes/php.pipe';

@Component({
  selector: 'app-helper-profile-modal',
  imports: [IonContent, IonFooter, IonIcon, DecimalPipe, AvatarComponent, PhpPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (helper(); as h) {
      <ion-content class="sheet">
        <div class="wrap">
          <header class="head">
            <app-avatar [src]="h.avatarUrl" [name]="h.name" [size]="72" [online]="h.isAvailable"></app-avatar>
            <div class="who">
              <h2>{{ h.name }} <ion-icon name="checkmark-circle" class="verified" aria-label="Verified"></ion-icon></h2>
              <span class="cat">{{ h.category }}</span>
              <div class="meta">
                <span class="stars" [attr.aria-label]="h.rating + ' out of 5'">
                  @for (s of [1, 2, 3, 4, 5]; track s) {
                    <ion-icon [name]="s <= h.rating + 0.25 ? 'star' : 'star-outline'" aria-hidden="true"></ion-icon>
                  }
                </span>
                <span>{{ h.rating | number: '1.1-1' }} ({{ h.reviewCount }})</span>
                <span>· {{ h.distanceKm }} km</span>
              </div>
            </div>
          </header>

          <div class="stats">
            <div><strong>{{ h.yearsExperience }} yrs</strong><span>Experience</span></div>
            <div><strong>{{ h.jobsDone }}</strong><span>Jobs done</span></div>
            <div><strong>&lt;15 min</strong><span>Response</span></div>
          </div>

          <section>
            <h3>About</h3>
            <p class="bio">{{ h.bio }}</p>
            <div class="creds">
              @for (c of h.credentials; track c) {
                <span class="cred" [class.nbi]="c.startsWith('NBI')">
                  <ion-icon [name]="c.startsWith('NBI') ? 'shield-checkmark' : 'ribbon-outline'" aria-hidden="true"></ion-icon>{{ c }}
                </span>
              }
            </div>
          </section>

          <section>
            <h3>Fixed-price services</h3>
            <ul class="skus">
              @for (sku of h.skus; track sku.id) {
                <li>
                  <button type="button" class="sku" [class.selected]="chosen()?.id === sku.id" (click)="chosen.set(sku)">
                    <span class="sku-text">
                      <span class="sku-name">{{ sku.name }}</span>
                      <span class="sku-meta">{{ sku.durationLabel }} · {{ sku.inclusions[0] }}</span>
                    </span>
                    <span class="price-tag">{{ sku.pricePhp | php: 'whole' }}/{{ sku.unit }}</span>
                  </button>
                </li>
              }
            </ul>
            <p class="note"><ion-icon name="information-circle-outline" aria-hidden="true"></ion-icon>Standard catalog rates. No bidding, no surprise quotes.</p>
          </section>

          <section>
            <h3>Recent reviews</h3>
            @for (r of h.reviews; track r.author + r.when) {
              <article class="review">
                <div class="r-head">
                  <strong>{{ r.author }}</strong>
                  <span class="r-stars">
                    @for (s of [1, 2, 3, 4, 5]; track s) {
                      <ion-icon [name]="s <= r.rating ? 'star' : 'star-outline'" aria-hidden="true"></ion-icon>
                    }
                  </span>
                  <span class="r-when">{{ r.when }}</span>
                </div>
                <p>“{{ r.text }}”</p>
              </article>
            }
          </section>
        </div>
      </ion-content>
      <ion-footer class="ion-no-border">
        <div class="servio-action-bar">
          @if (isSelf()) {
            <button type="button" class="pill-btn-outline block" disabled>
              Your Pro Profile
            </button>
            <p class="self-note">You cannot book your own service.</p>
          } @else {
            <button type="button" class="pill-btn block" (click)="bookService()">
              Book Service · <span class="price">{{ (chosen() ?? h.skus[0]).pricePhp | php: 'whole' }}</span>
            </button>
          }
        </div>
      </ion-footer>
    }
  `,
  styleUrl: './helper-profile-modal.component.scss',
})
export class HelperProfileModalComponent implements OnInit {
  @Input() helperId = 'daniel';

  private readonly modals = inject(ModalController);
  private readonly router = inject(Router);
  private readonly community = inject(CommunityService);
  private readonly auth = inject(AuthService);

  readonly helper = signal<HelperProfile | null>(null);
  readonly chosen = signal<ServiceSku | null>(null);
  readonly isSelf = computed(() => {
    const u = this.auth.user();
    const h = this.helper();
    if (!u || !h) return false;
    if (u.id === h.id) return true;
    return this.auth.settings.useMockApi() && !!u.fullName && u.fullName === h.name;
  });

  async ngOnInit(): Promise<void> {
    try {
      await this.community.directory();
      const h = this.community.helpers().find((x) => x.id === this.helperId);
      if (!h) { await this.modals.dismiss(); return; }
      this.helper.set(h); this.chosen.set(h.skus[0]);
    } catch { await this.modals.dismiss(); }
  }

  async bookService(): Promise<void> {
    if (this.isSelf()) return;
    const h = this.helper();
    const sku = this.chosen() ?? h?.skus[0];
    await this.modals.dismiss();
    this.router.navigate(['/checkout'], { queryParams: { helper: h?.id, sku: sku?.id } });
  }
}
