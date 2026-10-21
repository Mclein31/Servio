// tracking controls
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IonToggle } from '@ionic/angular';
import { TrackingService } from '../../../core/services/tracking.service';

@Component({
  selector:'app-tracking-controls',imports:[IonToggle],changeDetection:ChangeDetectionStrategy.OnPush,
  template:`
    @if (tracking.demoAllowed()) {
      <div class="controls"><span>Demo: simulate route</span><ion-toggle aria-label="Demo: simulate route" [checked]="tracking.simulate()" (ionChange)="tracking.setSimulated($any($event).detail.checked)"></ion-toggle></div>
    }
    @if (tracking.locationError()) { <p role="alert">{{ tracking.locationError() }}</p> }
  `,
  styles:`.controls { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 0; font-size:13px; color:var(--ion-color-medium); } p { font-size:13px; }`,
})
export class TrackingControlsComponent { readonly tracking=inject(TrackingService); }
