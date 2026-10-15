import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';
import { RequestStatus } from '../../models/ui.models';

const LABELS: Record<RequestStatus, string> = {
  OPEN: 'Open',
  URGENT: 'Urgent',
  ACCEPTED: 'Accepted',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

@Component({
  selector: 'app-status-badge',
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [ngClass]="status.toLowerCase()">@if (status === 'URGENT') {<span class="prefix" aria-hidden="true">!</span>}{{ label }}</span>`,
  styles: `
    :host { display: inline-flex; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 26px;
      padding: 0 12px;
      border-radius: var(--servio-radius-pill, 30px);
      font-size: 12px;
      line-height: 17px;
      font-weight: 600;
      white-space: nowrap;
    }
    .open { color: #2563EB; background: #EFF6FF; }
    .urgent { color: #DC2626; background: #FEF2F2; }
    .accepted, .in_progress { color: #D04A00; background: #FFF4ED; }
    .completed { color: #059669; background: #ECFDF5; }
    .cancelled { color: #6B7280; background: #F3F4F6; }
    .prefix {
      display: inline-grid;
      place-items: center;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #DC2626;
      color: #FFFFFF;
      font-size: 10px;
      font-weight: 800;
      line-height: 1;
    }
  `,
})
export class StatusBadgeComponent {
  @Input({ required: true }) status!: RequestStatus;
  @Input() customLabel?: string;

  get label(): string {
    return this.customLabel ?? LABELS[this.status];
  }
}
