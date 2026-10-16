import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';

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
  readonly isIos = Capacitor.getPlatform() === 'ios';

  readonly tabs: TabItem[] = [
    { tab: 'home', label: 'Home', icon: 'home-outline' },
    { tab: 'directory', label: 'Directory', icon: 'grid-outline' },
    { tab: 'bulletin', label: 'Bulletin', icon: 'newspaper-outline' },
    { tab: 'tracking', label: 'Tracking', icon: 'navigate-outline' },
    { tab: 'profile', label: 'Profile', icon: 'person-outline' },
  ];
}
