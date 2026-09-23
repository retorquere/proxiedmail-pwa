import { Routes } from '@angular/router'
import { authGuard } from './auth.guard'

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./views/home/home.component').then(m => m.HomeComponent),
    data: { title: $localize`ProxiedMail` },
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: '',
    loadComponent: () => import('./layout').then(m => m.DefaultLayoutComponent),
    canActivate: [authGuard],
    data: {
      title: $localize`Home`,
    },
    children: [
      {
        path: 'dashboard',
        loadChildren: () => import('./views/dashboard/routes').then(m => m.routes),
      },
      { path: 'settings', loadComponent: () => import('./views/settings/settings.component').then(m => m.SettingsComponent), data: { title: $localize`Settings` } },
      { path: 'domains', loadComponent: () => import('./views/domains/domains.component').then(m => m.DomainsComponent), data: { title: $localize`Domains` } },
    ],
  },
  {
    path: 'authentication',
    loadChildren: () => import('./views/authentication/routes').then(m => m.routes),
  },
  {
    path: 'error-pages',
    loadChildren: () => import('./views/error-pages/routes').then(m => m.routes),
  },
  { path: '**', redirectTo: 'dashboard' },
]
