// tabs routes
import { Routes } from '@angular/router';
import { proGuard } from '../core/guards/auth.guard';
import { TabsPage } from './tabs.page';

export const TABS_ROUTES: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      { path: 'home', loadComponent: () => import('../pages/home/home.page').then((m) => m.HomePage) },
      { path: 'directory', loadComponent: () => import('../pages/directory/directory.page').then((m) => m.DirectoryPage) },
      { path: 'bulletin', loadComponent: () => import('../pages/bulletin/bulletin.page').then((m) => m.BulletinPage) },
      { path: 'tracking', loadComponent: () => import('../pages/tracking/tracking.page').then((m) => m.TrackingPage) },
      { path: 'pro', canActivate: [proGuard], loadComponent: () => import('../pages/pro/dashboard/dashboard.page').then((m) => m.ProDashboardPage) },
      { path: 'profile', loadComponent: () => import('../pages/profile/profile.page').then((m) => m.ProfilePage) },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },
];
