import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { filter, take } from 'rxjs';
import { NotificationService } from './core/services/notification.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  readonly launching = signal(true);
  readonly pageReady = signal(false);

  constructor() {
    // Starts the inbox badge and device push registration for the signed-in account.
    inject(NotificationService);
    const router = inject(Router);
    const destroyRef = inject(DestroyRef);
    this.pageReady.set(router.navigated);

    const timer = setTimeout(() => {
      this.launching.set(false);
    }, 2000);
    destroyRef.onDestroy(() => clearTimeout(timer));

    router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      take(1),
      takeUntilDestroyed(destroyRef),
    ).subscribe(() => {
      this.pageReady.set(true);
    });
  }
}
