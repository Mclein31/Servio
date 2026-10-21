// onboarding trust visual
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { IonIcon } from '@ionic/angular';

@Component({
  selector: 'app-trust-visual',
  imports: [IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stage" [class.play]="play" aria-hidden="true">
      <div class="glow"></div>
      <div class="ring r1"></div>
      <div class="ring r2"></div>
      <div class="badge">
        <span class="icon lock"><ion-icon name="lock-closed"></ion-icon></span>
        <span class="icon shield"><ion-icon name="shield-checkmark"></ion-icon></span>
      </div>
      <div class="escrow">
        <span class="label">Held in escrow</span>
        <span class="amount">₱1,150.00</span>
      </div>
      <div class="pin">
        @for (d of digits; track $index) {
          <span class="digit" [style.--i]="$index">{{ d }}</span>
        }
      </div>
      <span class="release"><ion-icon name="checkmark-circle"></ion-icon>Released only with your PIN</span>
    </div>
  `,
  styles: `
    :host { display: block; }
    .stage {
      position: relative;
      height: 308px;
      border-radius: 24px;
      background: linear-gradient(180deg, #ECFDF5 0%, #F8FAF9 100%);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
    }
    .glow { position: absolute; width: 220px; height: 220px; border-radius: 50%; background: radial-gradient(circle, rgba(16,185,129,0.22), rgba(16,185,129,0) 70%); top: 10px; }
    .ring { position: absolute; top: 34px; width: 120px; height: 120px; border-radius: 50%; border: 2px solid rgba(16, 185, 129, 0.25); opacity: 0; }
    .badge { position: relative; width: 96px; height: 96px; margin-top: -10px; }
    .icon {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      border-radius: 28px;
      font-size: 46px;
      color: #FFFFFF;
      box-shadow: 0 14px 28px rgba(17, 24, 39, 0.16);
    }
    .lock { background: #D04A00; }
    .shield { background: linear-gradient(145deg, #10B981, #059669); opacity: 0; transform: scale(0.6) rotate(-12deg); }
    .escrow { display: flex; flex-direction: column; align-items: center; opacity: 0; transform: translateY(8px); }
    .label { font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #087F5B; }
    .amount { font-size: 22px; line-height: 28px; font-weight: 800; color: #111827; white-space: nowrap; }
    .pin { display: flex; gap: 8px; }
    .digit {
      display: grid;
      place-items: center;
      width: 40px;
      height: 46px;
      border-radius: 12px;
      background: #FFFFFF;
      border: 1.5px solid #A7F3D0;
      font-size: 22px;
      font-weight: 800;
      color: #087F5B;
      opacity: 0;
      transform: translateY(10px) scale(0.8);
    }
    .release { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #087F5B; opacity: 0; }

    /* unlock animation */
    .play .lock { animation: lock-out 0.6s ease-out 0.35s forwards; }
    .play .shield { animation: shield-in 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.2) 0.65s forwards; }
    .play .ring.r1 { animation: ring 1.6s ease-out 0.9s; }
    .play .ring.r2 { animation: ring 1.6s ease-out 1.2s; }
    .play .escrow { animation: up 0.6s ease-out 0.95s forwards; }
    .play .digit { animation: pop 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.4) forwards; animation-delay: calc(1.3s + var(--i) * 0.14s); }
    .play .release { animation: up 0.5s ease-out 2s forwards; }

    @keyframes lock-out { to { opacity: 0; transform: scale(0.7) rotate(10deg); } }
    @keyframes shield-in { to { opacity: 1; transform: none; } }
    @keyframes up { to { opacity: 1; transform: none; } }
    @keyframes pop { to { opacity: 1; transform: none; } }
    @keyframes ring { 0% { opacity: 0.9; transform: scale(0.8); } 100% { opacity: 0; transform: scale(1.8); } }

    @media (prefers-reduced-motion: reduce) {
      .lock { opacity: 0; }
      .shield, .escrow, .digit, .release { opacity: 1; transform: none; }
    }
  `,
})
export class TrustVisualComponent {
  @Input() play = false;
  readonly digits = ['7', '4', '9', '2'];
}
