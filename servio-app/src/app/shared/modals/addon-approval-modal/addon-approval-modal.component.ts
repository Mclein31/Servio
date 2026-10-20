import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon, ToastController } from '@ionic/angular';
import { ADDON_CATALOG } from '../../../core/data/mock-data';
import { OrderService } from '../../../core/services/order.service';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { PhpPipe } from '../../pipes/php.pipe';
import { formatPhp, roundCentavos } from '../../utils/money';

@Component({
  selector: 'app-addon-approval-modal',
  imports: [IonContent, IonIcon, AvatarComponent, PhpPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let o = orders.order();
    <ion-content>
      <div class="sheet-screen">
        <div class="sheet-context">
          <div><strong>Active order #{{ o.code ?? o.id }}</strong><span>{{ o.helper.name }} · {{ o.sku.name }}</span></div>
        </div>
        @if (quote(); as q) {
          <div class="sheet-panel" role="dialog" aria-labelledby="addon-title">
            <span class="sheet-handle" aria-hidden="true"></span>
            <span class="alert-pill"><ion-icon name="alert-circle" aria-hidden="true"></ion-icon>Action needed</span>
            <h1 id="addon-title" class="sheet-title">Add-on Scope Authorization Requested</h1>

            <div class="by">
              <app-avatar [src]="o.helper.avatarUrl" [name]="o.helper.name" [size]="28"></app-avatar>
              <span>{{ o.helper.name }} · {{ timeLabel(q.createdAt) }}</span>
            </div>

            <figure class="evidence">
              <img [src]="q.photoUrl" alt="Technician photo of the damaged part" />
              <figcaption><ion-icon name="camera" aria-hidden="true"></ion-icon>Photo evidence · {{ timeLabel(q.createdAt) }}</figcaption>
            </figure>
            <p class="note">“{{ q.note }}”</p>

            <div class="quote servio-card">
              <div class="row"><span>Additional Part</span><strong>{{ q.sku.name }}</strong></div>
              <div class="row"><span>Extra Escrow Charge</span><strong class="price add">{{ q.sku.pricePhp | php: 'signed' }}</strong></div>
              <div class="divider"></div>
              <div class="row total"><span>New Total Escrow</span><strong class="price">{{ newTotal() | php }}</strong></div>
            </div>
            <p class="fine">Standard catalog part price. Work on this add-on starts only after you approve.</p>

            @if (error()) { <p role="alert">{{ error() }}</p> }
            <div class="sheet-actions">
              @if (q.decision === 'PENDING') {
                <button type="button" class="pill-btn block" [disabled]="saving()" (click)="decide(true)">Approve & Authorize <span class="price">{{ q.sku.pricePhp | php: 'signed' }}</span></button>
                <button type="button" class="pill-btn-outline block" [disabled]="saving()" (click)="decide(false)">Decline Add-on</button>
              } @else {
                <div class="decided" [class.ok]="q.decision === 'APPROVED'">
                  <ion-icon [name]="q.decision === 'APPROVED' ? 'checkmark-circle' : 'close-circle'" aria-hidden="true"></ion-icon>
                  {{ q.decision === 'APPROVED' ? 'Approved — escrow updated' : 'Declined — original scope continues' }}
                </div>
                <button type="button" class="pill-btn-outline block" (click)="close()">Back to tracking</button>
              }
            </div>
          </div>
        }
      </div>
    </ion-content>
  `,
  styleUrl: './addon-approval-modal.component.scss',
})
export class AddonApprovalModalComponent {
  readonly orders = inject(OrderService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastController);

  readonly saving = signal(false);
  readonly error = signal('');
  readonly quote = computed(() => {
    const addons = this.orders.order().addons;
    return addons.find((a) => a.decision === 'PENDING') ?? addons[addons.length - 1] ?? null;
  });

  readonly newTotal = computed(() => {
    const q = this.quote();
    if (!q) return this.orders.escrowTotalPhp();
    return q.decision === 'APPROVED' ? this.orders.escrowTotalPhp() : roundCentavos(this.orders.escrowTotalPhp() + q.sku.pricePhp);
  });

  constructor() {
    if (this.orders.api.settings.useMockApi() && !this.orders.order().addons.length) {
      this.orders.pushAddonQuote(ADDON_CATALOG[0], 'assets/design/sample-drain-hose-evidence.png', 'Exposed drain hose is cracked and causing wall moisture.');
    }
  }

  timeLabel(d: Date): string {
    return d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  }

  async decide(approve: boolean): Promise<void> {
    const q = this.quote();
    if (!q || this.saving()) return;
    this.saving.set(true); this.error.set('');
    try { await this.orders.decideAddon(q.id, approve); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Could not decide add-on.'); return; }
    finally { this.saving.set(false); }
    const toast = await this.toasts.create({
      message: approve ? `Approved. Escrow is now ${formatPhp(this.orders.escrowTotalPhp())}.` : 'Add-on declined. Your helper continues the original job.',
      duration: 2000,
      position: 'top',
      color: approve ? 'success' : undefined,
    });
    await toast.present();
    this.close();
  }

  close(): void {
    this.router.navigateByUrl('/tabs/tracking');
  }
}
