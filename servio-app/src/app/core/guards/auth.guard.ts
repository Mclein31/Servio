import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Root entry: first run → onboarding; returning signed-out → login; signed-in → home. */
export const entryGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!(await auth.hasSeenOnboarding())) return router.parseUrl('/onboarding');
  return router.parseUrl((await auth.isAuthenticated()) ? auth.landingPath() : '/auth/login');
};

/** Protects signed-in areas. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return (await auth.isAuthenticated()) || router.parseUrl('/auth/login');
};

/** Keeps signed-in users out of the login flow. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return !(await auth.isAuthenticated()) || router.parseUrl(auth.landingPath());
};

export const proGuard: CanActivateFn = async () => {
  const auth = inject(AuthService); const router = inject(Router);
  if (!(await auth.isAuthenticated())) return router.parseUrl('/auth/login');
  return auth.settings.useMockApi() || auth.user()?.role === 'PRO' || router.parseUrl('/tabs/profile');
};
