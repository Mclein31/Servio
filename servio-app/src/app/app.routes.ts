// app routes
import { inject } from '@angular/core';
import { OrderService } from './core/services/order.service';
import { Routes } from '@angular/router';
import { authGuard, entryGuard, guestGuard, proGuard } from './core/guards/auth.guard';

const loadOrder = async (route: { paramMap: { get(name: string): string | null } }) => {
  const orders = inject(OrderService);
  const id=route.paramMap.get('id')!;
  if(orders.order().id!==id)await orders.load(id);
  return true;
};

export const routes: Routes = [
  { path: '', pathMatch: 'full', canActivate: [entryGuard], children: [] },

  { path: 'onboarding', loadComponent: () => import('./pages/onboarding/onboarding.page').then((m) => m.OnboardingPage) },
  { path: 'auth/login', canActivate: [guestGuard], loadComponent: () => import('./pages/auth/login/login.page').then((m) => m.LoginPage) },
  { path: 'auth/verify-otp', canActivate: [guestGuard], loadComponent: () => import('./pages/auth/verify-otp/verify-otp.page').then((m) => m.VerifyOtpPage) },

  { path: 'auth/profile', canActivate: [authGuard], loadComponent: () => import('./pages/auth/profile-setup/profile-setup.page').then((m) => m.ProfileSetupPage) },
  { path: 'legal/:type', loadComponent: () => import('./pages/legal/legal.page').then((m) => m.LegalPage) },

  { path: 'tabs', canActivate: [authGuard], loadChildren: () => import('./tabs/tabs.routes').then((m) => m.TABS_ROUTES) },
  { path: 'home', redirectTo: 'tabs/home' },
  { path: 'directory', redirectTo: 'tabs/directory' },
  { path: 'bulletin', redirectTo: 'tabs/bulletin' },
  { path: 'tracking', redirectTo: 'tabs/tracking' },
  { path: 'addresses', canActivate: [authGuard], loadComponent: () => import('./pages/addresses/addresses.page').then((m) => m.AddressesPage) },
  { path: 'profile/edit', canActivate: [authGuard], data: { editing: true }, loadComponent: () => import('./pages/auth/profile-setup/profile-setup.page').then((m) => m.ProfileSetupPage) },
  { path: 'rewards', canActivate: [authGuard], loadComponent: () => import('./pages/rewards/rewards.page').then(m => m.RewardsPage) },
  { path: 'payment-methods', canActivate: [authGuard], loadComponent: () => import('./pages/payment-methods/payment-methods.page').then(m => m.PaymentMethodsPage) },
  { path: 'notifications', canActivate: [authGuard], loadComponent: () => import('./pages/notifications/notifications.page').then(m => m.NotificationsPage) },
  { path: 'help', canActivate: [authGuard], loadComponent: () => import('./pages/help/help.page').then(m => m.HelpPage) },
  { path: 'profile', redirectTo: 'tabs/profile' },
  { path: 'helper/:id', redirectTo: ({ params }) => `/tabs/directory?helper=${params['id']}` },
  { path: 'bulletin/new', redirectTo: '/tabs/bulletin?compose=1' },

  { path: 'checkout', canActivate: [authGuard], loadComponent: () => import('./pages/checkout/checkout.page').then((m) => m.CheckoutPage) },
  { path: 'order/:id/chat', canActivate: [authGuard], resolve: { booking: loadOrder }, loadComponent: () => import('./pages/order/order-chat/order-chat.page').then((m) => m.OrderChatPage) },
  { path: 'order/:id/addon-modal', canActivate: [authGuard], resolve: { booking: loadOrder }, loadComponent: () => import('./shared/modals/addon-approval-modal/addon-approval-modal.component').then((m) => m.AddonApprovalModalComponent) },
  { path: 'order/:id/addon', redirectTo: 'order/:id/addon-modal' },
  { path: 'order/:id/completion', canActivate: [authGuard], resolve: { booking: loadOrder }, loadComponent: () => import('./shared/modals/completion-otp-modal/completion-otp-modal.component').then((m) => m.CompletionOtpModalComponent) },
  { path: 'order/:id/review', canActivate: [authGuard], resolve: { booking: loadOrder }, loadComponent: () => import('./shared/modals/rating-tip-modal/rating-tip-modal.component').then((m) => m.RatingTipModalComponent) },

  { path: 'pro', pathMatch: 'full', redirectTo: 'tabs/pro' },
  { path: 'pro/radar-alert', canActivate: [proGuard], loadComponent: () => import('./pages/pro/radar-alert/radar-alert.page').then((m) => m.RadarAlertPage) },
  { path: 'pro/radar', redirectTo: 'pro/radar-alert' },
  { path: 'pro/order/:id/execute', canActivate: [proGuard], resolve: { booking: loadOrder }, loadComponent: () => import('./pages/pro/job-execute/job-execute.page').then((m) => m.JobExecutePage) },
  { path: 'pro/order/:id/add-quote', canActivate: [proGuard], resolve: { booking: loadOrder }, loadComponent: () => import('./pages/pro/add-quote/add-quote.page').then((m) => m.AddQuotePage) },
  { path: 'pro/order/:id/quote', redirectTo: 'pro/order/:id/add-quote' },
  { path: 'pro/order/:id/verify-otp', canActivate: [proGuard], resolve: { booking: loadOrder }, loadComponent: () => import('./pages/pro/verify-otp/verify-otp.page').then((m) => m.ProVerifyOtpPage) },
  { path: 'pro/wallet', canActivate: [proGuard], loadComponent: () => import('./pages/pro/wallet/wallet.page').then((m) => m.WalletPage) },

  { path: '**', redirectTo: '' },
];
