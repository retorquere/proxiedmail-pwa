import { inject } from '@angular/core'
import { CanActivateFn, Router } from '@angular/router'

export const authGuard: CanActivateFn = (_route, state) => {
  if (localStorage.getItem('proxiedmail.apiToken')) return true
  return inject(Router).createUrlTree(['/authentication/login'], { queryParams: { returnUrl: state.url } })
}
