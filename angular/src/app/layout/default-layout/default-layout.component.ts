import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { NgScrollbar } from 'ngx-scrollbar';

import { IconDirective } from '@coreui/icons-angular';
import {
  ContainerComponent,
  ShadowOnScrollDirective,
  SidebarBrandComponent,
  SidebarComponent,
  SidebarFooterComponent,
  SidebarHeaderComponent,
  SidebarNavComponent,
  SidebarToggleDirective,
  SidebarTogglerDirective
} from '@coreui/angular';

import { DefaultFooterComponent } from './';
import { ProxyApiService } from '../../proxy-api.service';
import { navItems } from './_nav';

function isOverflown(element: HTMLElement) {
  return (
    element.scrollHeight > element.clientHeight ||
    element.scrollWidth > element.clientWidth
  );
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './default-layout.component.html',
  styleUrls: ['./default-layout.component.scss'],
  imports: [
    ContainerComponent,
    DefaultFooterComponent,
    RouterOutlet,
    RouterLink
  ]
})
export class DefaultLayoutComponent {
  private readonly api = inject(ProxyApiService);
  private readonly router = inject(Router);
  public navItems = [...navItems];

  logout() { this.api.logout(); this.router.navigateByUrl('/authentication/login'); }
}
