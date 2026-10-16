import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { OrderService } from '../../../core/services/order.service';
import { PhpPipe } from '../../pipes/php.pipe';

/** Deterministic 21×21 pseudo-QR pattern (illustrative fallback token, not a scannable code). */
function qrCells(seed: string): boolean[] {
  const size = 21;
  const cells: boolean[] = [];
  let h = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      if (finder) {
        const fx = x > 13 ? x - 14 : x;
        const fy = y > 13 ? y - 14 : y;
        cells.push(fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4));
      } else {
        h = (h * 1103515245 + 12345) >>> 0;
        cells.push((h >>> 16) % 2 === 0);
      }
    }
  }
  return cells;
}

/** Customer's single-use 4-digit completion PIN (ADR-002). Routed at /order/:id/completion. */
@Component({
  selector: 'app-completion-otp-modal',
  imports: [IonContent, IonIcon, RouterLink, PhpPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let o = orders.order();
    <ion-content>
      <div class="sheet-screen">
        <div class="sheet-context">
          <div><strong>Active order #{{ o.code ?? o.id }}</strong><span>{{ o.helper.name }} · {{ o.sku.name }}</span></div>
        </div>
        <div class="sheet-panel" role="dialog" aria-labelledby="pin-title">
          <span class="sheet-handle" aria-hidden="true"></span>

          @if (o.escrow === 'COMPLETED') {
            <div class="released">
              <span class="check"><ion-icon name="checkmark" aria-hidden="true"></ion-icon></span>
              <h1 class="sheet-title">Job complete</h1>
              <p><span class="price">{{ orders.escrowTotalPhp() | php }}</span> was released from escrow to {{ o.helper.name }}.</p>
              <a class="pill-btn block" [routerLink]="['/order', o.id, 'review']">Rate & Tip {{ o.helper.name }}</a>
            </div>
          } @else {
            <div class="pin-card">
              <div class="pin-inner">
                <span class="shield"><ion-icon name="shield-checkmark" aria-hidden="true"></ion-icon></span>
                <h1 id="pin-title">Your Service Completion PIN</h1>
                <p class="sub">Inspect the completed work before sharing this code with your technician.</p>
                <div class="digits" [attr.aria-label]="'PIN ' + o.completionPin.split('').join(' ')">
                  @for (d of o.completionPin.split(''); track $index) {
                    <span class="digit" [style.--i]="$index" aria-hidden="true">{{ d }}</span>
                  }
                </div>
                <button type="button" class="qr-toggle" (click)="showQr.set(!showQr())" [attr.aria-expanded]="showQr()">
                  <ion-icon name="qr-code-outline" aria-hidden="true"></ion-icon>{{ showQr() ? 'Hide QR code' : 'Show QR code instead' }}
                </button>
                @if (showQr()) {
                  <svg class="qr" viewBox="0 0 21 21" shape-rendering="crispEdges" role="img" aria-label="Completion QR code (sample)">
                    @for (on of qr; track $index) {
                      @if (on) { <rect [attr.x]="$index % 21" [attr.y]="floor($index / 21)" width="1" height="1" /> }
                    }
                  </svg>
                }
              </div>
            </div>

            <h2 class="check-title">Before you share</h2>
            <ul class="checklist">
              @for (item of checklist; track item; let i = $index) {
                <li>
                  <button type="button" [class.on]="checked()[i]" (click)="toggle(i)" role="checkbox" [attr.aria-checked]="checked()[i]">
                    <span class="box"><ion-icon name="checkmark" aria-hidden="true"></ion-icon></span>{{ item }}
                  </button>
                </li>
              }
            </ul>

            <div class="warning">
              <ion-icon name="warning-outline" aria-hidden="true"></ion-icon>
              <p>Do not release this PIN if you are dissatisfied. Sharing this PIN authorizes the release of <strong class="price">{{ orders.escrowTotalPhp() | php }}</strong> from escrow.</p>
            </div>

            <div class="sheet-actions">
              @if (orders.api.settings.useMockApi()) { <a class="pill-btn-outline block brand" [routerLink]="['/pro/order', o.id, 'verify-otp']">
                <ion-icon name="swap-horizontal-outline" aria-hidden="true"></ion-icon> Demo: open Pro PIN entry
              </a> }
              <a class="text-btn center" routerLink="/tabs/tracking">Back to tracking</a>
            </div>
          }
        </div>
      </div>
    </ion-content>
  `,
  styleUrl: './completion-otp-modal.component.scss',
})
export class CompletionOtpModalComponent {
  readonly orders = inject(OrderService);
  readonly router = inject(Router);

  readonly checklist = ['Work area cleaned', 'Repairs tested in operation', 'No unexpected charges'];
  readonly checked = signal([false, false, false]);
  readonly allChecked = computed(() => this.checked().every(Boolean));
  readonly showQr = signal(false);
  readonly qr = qrCells(this.orders.order().id + this.orders.order().completionPin);

  floor(v: number): number {
    return Math.floor(v);
  }

  toggle(i: number): void {
    this.checked.update((c) => c.map((v, idx) => (idx === i ? !v : v)));
  }
}
