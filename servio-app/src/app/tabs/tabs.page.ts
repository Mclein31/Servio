// tabs
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { AuthService } from '../core/services/auth.service';

interface TabItem {
  tab: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrl: 'tabs.page.scss',
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabsPage {
  private readonly auth = inject(AuthService);
  readonly tabs = computed<TabItem[]>(() => [
    this.auth.user()?.role === 'PRO' ? { tab: 'pro', label: 'Dashboard', icon: 'speedometer-outline' } : { tab: 'home', label: 'Home', icon: 'home-outline' },
    { tab: 'directory', label: 'Directory', icon: 'grid-outline' },
    { tab: 'bulletin', label: 'Bulletin', icon: 'newspaper-outline' },
    { tab: 'tracking', label: 'Tracking', icon: 'navigate-outline' },
    { tab: 'profile', label: 'Profile', icon: 'person-outline' },
  ]);
}
