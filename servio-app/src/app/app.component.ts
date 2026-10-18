import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { filter, take } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  readonly launching = signal(true);

  constructor() {
    const router = inject(Router);
    const destroyRef = inject(DestroyRef);
    let minimumElapsed = false;
    let pageReady = router.navigated;
    const reveal = () => {
      if (minimumElapsed && pageReady) this.launching.set(false);
    };

    const timer = setTimeout(() => {
      minimumElapsed = true;
      reveal();
    }, 1400);
    destroyRef.onDestroy(() => clearTimeout(timer));

    router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      take(1),
      takeUntilDestroyed(destroyRef),
    ).subscribe(() => {
      pageReady = true;
      reveal();
    });
  }
}
