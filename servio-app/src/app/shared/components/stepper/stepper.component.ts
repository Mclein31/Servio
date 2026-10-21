// stepper
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { buildMilestones, StepMilestone } from '../../models/ui.models';

@Component({
  selector: 'app-stepper',
  imports: [IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="stepper" [class.compact]="compact" [attr.aria-label]="'Order progress'">
      @for (step of steps; track step.index; let last = $last) {
        <li class="step" [class.completed]="step.isCompleted" [class.active]="step.isActive" [attr.aria-current]="step.isActive ? 'step' : null">
          <div class="track">
            <span class="dot">
              @if (step.isCompleted) {
                <ion-icon name="checkmark" aria-hidden="true"></ion-icon>
              } @else if (step.isActive) {
                <span class="core"></span>
              }
            </span>
            @if (!last) {
              <span class="line" [class.filled]="steps[step.index + 1]?.isCompleted || steps[step.index + 1]?.isActive"></span>
            }
          </div>
          <span class="label">{{ step.label }}</span>
          @if (showTimes && step.time) {
            <span class="time">{{ step.time }}</span>
          }
        </li>
      }
    </ol>
  `,
  styles: `
    :host { display: block; }
    .stepper { display: flex; list-style: none; margin: 0; padding: 0; }
    .step { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: center; text-align: center; }
    .track { position: relative; width: 100%; height: 24px; display: flex; justify-content: center; align-items: center; }
    .dot {
      position: relative;
      z-index: 1;
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #E5E7EB;
      color: #FFFFFF;
      font-size: 14px;
      transition: background-color 0.35s ease, box-shadow 0.35s ease;
    }
    .completed .dot { background: #FF5C00; }
    .active .dot {
      background: #FF5C00;
      box-shadow: 0 0 0 4px rgba(255, 92, 0, 0.18);
      animation: ring 1.8s ease-out infinite;
    }
    .core { width: 9px; height: 9px; border-radius: 50%; background: #FFFFFF; }
    .line {
      position: absolute;
      top: 50%;
      left: calc(50% + 12px);
      width: calc(100% - 24px);
      height: 3px;
      margin-top: -1.5px;
      border-radius: 2px;
      background: #E5E7EB;
      overflow: hidden;
    }
    .line::after {
      content: '';
      position: absolute;
      inset: 0;
      background: #FF5C00;
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.5s ease;
    }
    .line.filled::after { transform: scaleX(1); }
    .label {
      margin-top: 6px;
      max-width: 100%;
      font-size: 11px;
      line-height: 14px;
      font-weight: 500;
      color: #6B7280;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .active .label { color: #111827; font-weight: 700; }
    .time { margin-top: 2px; font-size: 10px; line-height: 13px; color: #9CA3AF; white-space: nowrap; }
    .compact .dot { width: 18px; height: 18px; font-size: 11px; }
    .compact .track { height: 18px; }
    .compact .line { left: calc(50% + 9px); width: calc(100% - 18px); }
    .compact .core { width: 7px; height: 7px; }
    @keyframes ring {
      0% { box-shadow: 0 0 0 0 rgba(255, 92, 0, 0.35); }
      70% { box-shadow: 0 0 0 8px rgba(255, 92, 0, 0); }
      100% { box-shadow: 0 0 0 0 rgba(255, 92, 0, 0); }
    }
  `,
})
export class StepperComponent {
  @Input() steps: StepMilestone[] = buildMilestones(2);
  @Input() showTimes = false;
  @Input() compact = false;
}
