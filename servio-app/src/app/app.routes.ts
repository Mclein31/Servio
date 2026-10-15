import { Routes } from '@angular/router';
import { authGuard, entryGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', canActivate: [entryGuard], children: [] },

  // Intro & auth
  { path: 'onboarding', loadComponent: () => import('./pages/onboarding/onboarding.page').then((m) => m.OnboardingPage) },
  { path: 'auth/login', canActivate: [guestGuard], loadComponent: () => import('./pages/auth/login/login.page').then((m) => m.LoginPage) },
  { path: 'auth/verify-otp', canActivate: [guestGuard], loadComponent: () => import('./pages/auth/verify-otp/verify-otp.page').then((m) => m.VerifyOtpPage) },

  // Customer — 5-tab shell
  { path: 'tabs', canActivate: [authGuard], loadChildren: () => import('./tabs/tabs.routes').then((m) => m.TABS_ROUTES) },
  { path: 'home', redirectTo: 'tabs/home' },
  { path: 'directory', redirectTo: 'tabs/directory' },
  { path: 'bulletin', redirectTo: 'tabs/bulletin' },
  { path: 'tracking', redirectTo: 'tabs/tracking' },
  { path: 'profile', redirectTo: 'tabs/profile' },
  // Screen-inventory aliases: these open as modals over their parent tab.
  { path: 'helper/:id', redirectTo: ({ params }) => `/tabs/directory?helper=${params['id']}` },
  { path: 'bulletin/new', redirectTo: '/tabs/bulletin?compose=1' },

  // Customer — booking & order lifecycle
  { path: 'checkout', canActivate: [authGuard], loadComponent: () => import('./pages/checkout/checkout.page').then((m) => m.CheckoutPage) },
  { path: 'order/:id/chat', canActivate: [authGuard], loadComponent: () => import('./pages/order/order-chat/order-chat.page').then((m) => m.OrderChatPage) },
  { path: 'order/:id/addon-modal', canActivate: [authGuard], loadComponent: () => import('./shared/modals/addon-approval-modal/addon-approval-modal.component').then((m) => m.AddonApprovalModalComponent) },
  { path: 'order/:id/addon', redirectTo: 'order/:id/addon-modal' },
  { path: 'order/:id/completion', canActivate: [authGuard], loadComponent: () => import('./shared/modals/completion-otp-modal/completion-otp-modal.component').then((m) => m.CompletionOtpModalComponent) },
  { path: 'order/:id/review', canActivate: [authGuard], loadComponent: () => import('./shared/modals/rating-tip-modal/rating-tip-modal.component').then((m) => m.RatingTipModalComponent) },

  // Servio Pro
  { path: 'pro', canActivate: [authGuard], loadComponent: () => import('./pages/pro/dashboard/dashboard.page').then((m) => m.ProDashboardPage) },
  { path: 'pro/radar-alert', canActivate: [authGuard], loadComponent: () => import('./pages/pro/radar-alert/radar-alert.page').then((m) => m.RadarAlertPage) },
  { path: 'pro/radar', redirectTo: 'pro/radar-alert' },
  { path: 'pro/order/:id/execute', canActivate: [authGuard], loadComponent: () => import('./pages/pro/job-execute/job-execute.page').then((m) => m.JobExecutePage) },
  { path: 'pro/order/:id/add-quote', canActivate: [authGuard], loadComponent: () => import('./pages/pro/add-quote/add-quote.page').then((m) => m.AddQuotePage) },
  { path: 'pro/order/:id/quote', redirectTo: 'pro/order/:id/add-quote' },
  { path: 'pro/order/:id/verify-otp', canActivate: [authGuard], loadComponent: () => import('./pages/pro/verify-otp/verify-otp.page').then((m) => m.ProVerifyOtpPage) },
  { path: 'pro/wallet', canActivate: [authGuard], loadComponent: () => import('./pages/pro/wallet/wallet.page').then((m) => m.WalletPage) },

  { path: '**', redirectTo: '' },
];
