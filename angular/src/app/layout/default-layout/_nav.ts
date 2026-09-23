import { INavData } from '@coreui/angular';

export const navItems: INavData[] = [
  { name: $localize`Dashboard`, url: '/dashboard', iconComponent: { name: 'cil-speedometer' } },
  { name: $localize`Settings`, url: '/settings', iconComponent: { name: 'cil-settings' } },
];
