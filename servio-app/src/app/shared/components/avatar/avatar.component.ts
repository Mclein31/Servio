// avatar
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

const PALETTE = ['#FFF2E8', '#EBF5FF', '#EDFAF0', '#FDF0F5', '#F3E8FF'];
const INK = ['#B64000', '#1D4ED8', '#047857', '#BE185D', '#6D28D9'];

@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (src) {
      <img [src]="src" [alt]="name" [style.width.px]="size" [style.height.px]="size" loading="lazy" />
    } @else {
      <span class="initials" [style.width.px]="size" [style.height.px]="size" [style.fontSize.px]="size * 0.36"
        [style.color]="palette[1]" role="img" [attr.aria-label]="name">{{ initials }}</span>
    }
    @if (online) {
      <span class="online" [style.width.px]="dotSize" [style.height.px]="dotSize" aria-label="Online"></span>
    }
  `,
  styles: `
    :host { position: relative; display: inline-block; flex: 0 0 auto; line-height: 0; }
    img, .initials { display: block; border-radius: 50%; object-fit: cover; background: #F3F4F6; }
    .initials { display: grid; place-items: center; font-weight: 700; line-height: 1; background: none; }
    /* online dot */
    .online {
      position: absolute;
      left: 82%;
      top: 76%;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      background: #10B981;
      border: 2.5px solid #FFFFFF;
      box-sizing: border-box;
    }
  `,
})
export class AvatarComponent {
  @Input() src = '';
  @Input() name = '';
  @Input() size = 48;
  @Input() online = false;

  get dotSize(): number {
    return Math.max(12, Math.round(this.size * 0.24));
  }

  get initials(): string {
    return this.name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
  }

  get palette(): [string, string] {
    const hash = [...this.name].reduce((h, c) => h + c.charCodeAt(0), 0);
    return [PALETTE[hash % PALETTE.length], INK[hash % INK.length]];
  }
}
