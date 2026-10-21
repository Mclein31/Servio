// rating and tip modal
import { ChangeDetectionStrategy, Component, DestroyRef, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonFooter, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular';
import { OrderService } from '../../../core/services/order.service';
import { RatingFormComponent } from '../../components/rating-form/rating-form.component';

@Component({
  selector: 'app-rating-tip-modal',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonFooter, IonIcon, RatingFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
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
        <app-rating-form [showSubmit]="false" (submitted)="done()"></app-rating-form>
      </div>
    </ion-content>

    <ion-footer class="ion-no-border">
      <div class="servio-action-bar">
        <button type="button" class="pill-btn block" [disabled]="!form?.canSubmit()" (click)="form?.submit()">Submit Review & Close</button>
      </div>
    </ion-footer>
  `,
  styleUrl: './rating-tip-modal.component.scss',
})
export class RatingTipModalComponent {
  private readonly router = inject(Router);
  @ViewChild(RatingFormComponent) form?: RatingFormComponent;

  constructor() {
    const orders = inject(OrderService);
    inject(DestroyRef).onDestroy(orders.keep(orders.order().id));
  }

  done(): void {
    this.router.navigateByUrl('/tabs/home', { replaceUrl: true });
  }

  close(): void {
    this.router.navigateByUrl('/tabs/tracking');
  }
}
