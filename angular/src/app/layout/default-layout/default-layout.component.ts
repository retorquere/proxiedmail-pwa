import { Component, inject } from '@angular/core'
import { Router, RouterLink, RouterOutlet } from '@angular/router'

import { ContainerComponent } from '@coreui/angular'

import { ProxyApiService } from '../../proxy-api.service'

@Component({
  selector: 'app-dashboard',
  templateUrl: './default-layout.component.html',
  styleUrls: ['./default-layout.component.scss'],
  imports: [
    ContainerComponent,
    RouterOutlet,
    RouterLink,
  ],
})
export class DefaultLayoutComponent {
  private readonly api = inject(ProxyApiService)
  private readonly router = inject(Router)

  logout() {
    this.api.logout()
    this.router.navigateByUrl('/authentication/login')
  }
}
