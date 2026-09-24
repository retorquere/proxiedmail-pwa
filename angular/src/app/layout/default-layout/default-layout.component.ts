import { Component, inject } from '@angular/core'
import { RouterLink, RouterOutlet } from '@angular/router'

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

  logout() {
    this.api.logout()
    window.location.replace('/')
  }
}
