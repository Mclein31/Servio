import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { IonIcon } from '@ionic/angular';
import { HelperSummary } from '../../models/ui.models';
import { AvatarComponent } from '../avatar/avatar.component';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-helper-card',
  imports: [DecimalPipe, IonIcon, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card" [class.compact]="compact" (click)="selected.emit(helper.id)" (keydown.enter)="selected.emit(helper.id)"
      tabindex="0" role="button" [attr.aria-label]="'View ' + helper.name + ' profile'">
      <div class="top">
        <app-avatar [src]="helper.avatarUrl" [name]="helper.name" [size]="54" [online]="helper.isAvailable"></app-avatar>
        @if (helper.badgeLabel && !compact) {
          <span class="ribbon">{{ helper.badgeLabel }}</span>
        }
      </div>
      <h3 class="name">{{ helper.name }}</h3>
      <span class="category">{{ helper.category }}</span>
      <div class="meta">
        <span class="rating"><ion-icon name="star" aria-hidden="true"></ion-icon>{{ helper.rating | number: '1.1-1' }} <span class="count">({{ helper.reviewCount }})</span></span>
        <span class="distance"><ion-icon name="location-outline" aria-hidden="true"></ion-icon>{{ helper.distanceKm }} km away</span>
      </div>
      <span class="price-tag">₱{{ helper.hourlyRatePhp | number: '1.0-0' }}/{{ helper.rateUnit ?? 'hr' }}</span>
      @if (!compact) {
        @if (isOwn()) {
          <button type="button" class="action self" (click)="onSelf($event)">Your Profile</button>
        } @else if (actionMode === 'book') {
          <button type="button" class="action book" (click)="onBook($event)">Book Now</button>
        } @else {
          <button type="button" class="action available" (click)="onBook($event)" [disabled]="!helper.isAvailable">
            {{ helper.isAvailable ? 'Available' : 'Busy' }}
          </button>
        }
      }
    </article>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .card {
      display: flex;
      flex-direction: column;
      gap: 6px;
      height: 100%;
      padding: 16px;
      background: #FFFFFF;
      border-radius: 20px;
      border: 1px solid #F3F4F6;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      box-sizing: border-box;
    }
    .card:active { transform: scale(0.985); }
    .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; min-height: 54px; }
    .ribbon {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: #087F5B;
      background: #ECFDF5;
      padding: 3px 8px;
      border-radius: 30px;
      white-space: nowrap;
    }
    .name { margin: 0; font-size: 16px; line-height: 22px; font-weight: 600; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .category {
      align-self: flex-start;
      max-width: 100%;
      padding: 3px 10px;
      border-radius: 30px;
      background: #FFF2E8;
      color: #B64000;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      box-sizing: border-box;
    }
    .meta { display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 12px; line-height: 17px; color: #6B7280; }
    .rating, .distance { display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
    .rating { color: #111827; font-weight: 600; }
    .rating ion-icon { color: #F59E0B; }
    .count { color: #6B7280; font-weight: 500; }
    .price-tag { font-size: 16px; line-height: 22px; font-weight: 700; color: #B64000; white-space: nowrap; }
    .action {
      margin-top: auto;
      min-height: 40px;
      border: 0;
      border-radius: 30px;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: background-color 0.15s ease;
    }
    .available { background: #FFF2E8; color: #B64000; }
    .available:disabled { background: #F3F4F6; color: #9CA3AF; }
    .book { background: #D04A00; color: #FFFFFF; }
    .book:active { background: #C24400; }
    .self { background: #F3F4F6; color: #4B5563; }
    .compact { padding: 14px; gap: 4px; }
  `,
})
export class HelperCardComponent {
  @Input({ required: true }) helper!: HelperSummary;
  /** 'available' shows the [Available] capsule; 'book' shows the [Book Now] pill. */
  @Input() actionMode: 'available' | 'book' = 'available';
  @Input() compact = false;
  @Output() selected = new EventEmitter<string>();
  @Output() book = new EventEmitter<string>();

  private readonly auth = inject(AuthService, { optional: true });
  readonly isOwn = computed(() => {
    const u = this.auth?.user();
    if (!u || !this.helper) return false;
    if (u.id === this.helper.id) return true;
    return (this.auth?.settings.useMockApi() ?? true) && !!u.fullName && u.fullName === this.helper.name;
  });

  onBook(event: Event): void {
    event.stopPropagation();
    this.book.emit(this.helper.id);
  }

  onSelf(event: Event): void {
    event.stopPropagation();
    this.selected.emit(this.helper.id);
  }
}
