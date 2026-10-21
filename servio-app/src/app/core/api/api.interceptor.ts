// api interceptor
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { ApiSettingsService } from './api-settings.service';
import { SessionService } from './session.service';

export class ApiFailure extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly requestId?: string) { super(message); }
}

export const apiInterceptor: HttpInterceptorFn = (request, next) => {
  const settings = inject(ApiSettingsService);
  const sessions = inject(SessionService);
  const toasts = inject(ToastController);
  return from(settings.ready).pipe(switchMap(() => {
    const base = settings.apiUrl();
    if (!base || !(request.url === base || request.url.startsWith(`${base}/`))) return next(request);
    return from(sessions.get()).pipe(switchMap((token) => {
      const headers: Record<string, string> = { 'X-Request-Id': crypto.randomUUID() };
      if (token && !token.startsWith('mock.')) headers['Authorization'] = `Bearer ${token}`;
      return next(request.clone({ setHeaders: headers })).pipe(catchError((error: unknown) => {
        const response = error instanceof HttpErrorResponse ? error : null;
        const envelope = response?.error?.error;
        const failure = new ApiFailure(response?.status ?? 0, typeof envelope?.code === 'string' ? envelope.code : 'CONNECTION_FAILED',
          typeof envelope?.message === 'string' ? envelope.message : 'Cannot reach SERVIO. Check the Wi-Fi and API address.',
          typeof envelope?.requestId === 'string' ? envelope.requestId : undefined);
        if (failure.status === 401 && !request.url.startsWith(`${base}/auth/`)) void sessions.clear();
        if (!request.url.includes('/uploads/')) {
          void toasts.create({ message: failure.message, duration: 3500, position: 'top' }).then((toast) => toast.present());
        }
        return throwError(() => failure);
      }));
    }));
  }));
};
