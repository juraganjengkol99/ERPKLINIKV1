import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { CloudStateService } from '../services/cloud-state.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const state = inject(CloudStateService);
  const token = state.token();
  const isAuthLogin = req.url.includes('/api/auth/login');

  const cloned = token && !isAuthLogin
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(cloned).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !isAuthLogin && state.isAuthenticated()) {
        state.forceExpireSession();
      }
      return throwError(() => err);
    })
  );
};
