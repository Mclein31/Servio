import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, ViewChild, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';

/** Release must exceed 90% of the track to authorize. */
export const SLIDE_CONFIRM_THRESHOLD = 0.9;

/** True when a release at `progress` (0..1) should trigger authorization. */
export function slideReleaseConfirms(progress: number): boolean {
  return progress > SLIDE_CONFIRM_THRESHOLD;
}

/**
 * "Slide to authorize" control. Fires `confirmed` only when the thumb is
 * released beyond 90% of the track; otherwise it springs back. Keyboard users
 * can drive it with the arrow keys / Home / End (role="slider").
 */
@Component({
  selector: 'app-slide-to-confirm',
  imports: [IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #trackEl class="track" [class.done]="done()" [class.disabled]="disabled">
      <div class="fill" [style.width.px]="fillWidth()"></div>
      <span class="label" [style.opacity]="1 - progress() * 1.4">
        <span class="chev" aria-hidden="true"><ion-icon name="chevron-forward"></ion-icon><ion-icon name="chevron-forward"></ion-icon><ion-icon name="chevron-forward"></ion-icon></span> {{ label }} <span class="chev" aria-hidden="true"><ion-icon name="chevron-forward"></ion-icon><ion-icon name="chevron-forward"></ion-icon><ion-icon name="chevron-forward"></ion-icon></span>
      </span>
      <span class="done-label" [style.opacity]="done() ? 1 : 0">{{ doneLabel }}</span>
      <button
        type="button"
        class="thumb"
        [class.dragging]="dragging()"
        [style.transform]="'translateX(' + offset() + 'px)'"
        role="slider"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-valuenow]="round(progress() * 100)"
        [attr.aria-label]="label"
        [disabled]="disabled || done()"
        (pointerdown)="onDown($event)"
        (pointermove)="onMove($event)"
        (pointerup)="onUp()"
        (pointercancel)="reset()"
        (keydown)="onKey($event)"
      >
        <ion-icon [name]="done() ? 'checkmark' : 'chevron-forward'" aria-hidden="true"></ion-icon>
      </button>
    </div>
  `,
  styles: `
    :host { display: block; }
    .track {
      position: relative;
      height: 60px;
      border-radius: 30px;
      background: #D04A00;
      overflow: hidden;
      touch-action: pan-y;
      user-select: none;
      box-shadow: 0 10px 24px rgba(208, 74, 0, 0.28);
    }
    .track.disabled { opacity: 0.4; }
    .fill { position: absolute; inset: 0 auto 0 0; background: #C24400; border-radius: 30px; }
    .label, .done-label {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding-left: 48px;
      color: #FFFFFF;
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
      pointer-events: none;
    }
    .done-label { padding-left: 0; transition: opacity 0.2s ease; }
    .chev { display: inline-flex; align-items: center; opacity: 0.7; animation: shimmer 1.6s ease-in-out infinite; }
    .chev ion-icon + ion-icon { margin-left: -8px; }
    .thumb {
      position: absolute;
      top: 6px;
      left: 6px;
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: #FFFFFF;
      color: #D04A00;
      font-size: 24px;
      cursor: grab;
      touch-action: none;
      box-shadow: 0 4px 10px rgba(17, 24, 39, 0.2);
      transition: transform 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.2);
    }
    .thumb.dragging { transition: none; cursor: grabbing; }
    .done .thumb { color: #087F5B; }
    .done { background: #087F5B; box-shadow: 0 10px 24px rgba(8, 127, 91, 0.28); }
    .done .fill { background: #087F5B; }
    @keyframes shimmer { 50% { opacity: 1; } }
  `,
})
export class SlideToConfirmComponent {
  @Input() label = 'Slide to Authorize & Book';
  @Input() doneLabel = 'Authorized';
  @Input() disabled = false;
  @Output() confirmed = new EventEmitter<void>();

  @ViewChild('trackEl', { static: true }) trackEl!: ElementRef<HTMLDivElement>;

  readonly offset = signal(0);
  readonly dragging = signal(false);
  readonly done = signal(false);
  readonly progress = signal(0);
  readonly fillWidth = signal(0);

  private startX = 0;
  private startOffset = 0;

  round(v: number): number {
    return Math.round(v);
  }

  private get max(): number {
    return this.trackEl.nativeElement.clientWidth - 60; // 48px thumb + 2 × 6px inset
  }

  onDown(e: PointerEvent): void {
    if (this.done() || this.disabled) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    this.dragging.set(true);
    this.startX = e.clientX;
    this.startOffset = this.offset();
  }

  onMove(e: PointerEvent): void {
    if (!this.dragging()) return;
    this.setOffset(this.startOffset + e.clientX - this.startX);
  }

  onUp(): void {
    if (!this.dragging()) return;
    this.dragging.set(false);
    if (slideReleaseConfirms(this.progress())) this.complete();
    else this.reset();
  }

  onKey(e: KeyboardEvent): void {
    if (this.done()) return;
    const step = this.max * 0.1;
    if (e.key === 'ArrowRight') this.setOffset(this.offset() + step);
    else if (e.key === 'ArrowLeft') this.setOffset(this.offset() - step);
    else if (e.key === 'End') this.setOffset(this.max);
    else if (e.key === 'Home') this.setOffset(0);
    else return;
    e.preventDefault();
    if (this.progress() >= 1) this.complete();
  }

  reset(): void {
    this.done.set(false);
    this.dragging.set(false);
    this.setOffset(0);
  }

  private complete(): void {
    this.setOffset(this.max);
    this.done.set(true);
    setTimeout(() => this.confirmed.emit(), 380);
  }

  private setOffset(px: number): void {
    const clamped = Math.max(0, Math.min(this.max, px));
    this.offset.set(clamped);
    this.progress.set(this.max > 0 ? clamped / this.max : 0);
    this.fillWidth.set(clamped + 54);
  }
}
