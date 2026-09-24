import { Routes } from '@angular/router'

export const routes: Routes = [
  {
    path: '',
    data: {
      title: $localize`Authentication`,
    },
    children: [
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full',
      },
      {
        path: 'login',
        loadComponent: () => import('./login/login.component').then(m => m.LoginComponent),
        data: {
          title: $localize`Login`,
        },
      },
      {
        path: 'register',
        loadComponent: () => import('./register/register.component').then(m => m.RegisterComponent),
        data: {
          title: $localize`Register`,
        },
      },
      {
        path: 'check-email',
        loadComponent: () => import('./check-email/check-email.component').then(m => m.CheckEmailComponent),
        data: {
          title: $localize`Check Email`,
        },
      },
      {
        path: 'password',
        children: [
          {
            path: 'reset',
            loadComponent: () => import('./reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
            data: {
              title: $localize`Reset Password`,
            },
          },
          {
            path: 'change',
            loadComponent: () => import('./change-password/change-password.component').then(m => m.ChangePasswordComponent),
            data: {
              title: $localize`Change Password`,
            },
          },
          {
            path: 'changed',
            loadComponent: () => import('./password-changed/password-changed.component').then(m => m.PasswordChangedComponent),
            data: {
              title: $localize`Password Changed`,
            },
          },
        ],
      },
    ],
  },
]
