import { CommonModule } from '@angular/common'
import { Component, computed, inject, signal } from '@angular/core'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { ButtonDirective, CardBodyComponent, CardComponent, ColComponent, ContainerComponent, RowComponent } from '@coreui/angular'
import { ProxyApiService } from '../../../proxy-api.service'

@Component({
  selector: 'app-check-email',
  imports: [
    ButtonDirective,
    CardBodyComponent,
    CardComponent,
    ColComponent,
    CommonModule,
    ContainerComponent,
    RouterLink,
    RowComponent,
  ],
  templateUrl: './check-email.component.html',
  host: {
    class: 'bg-body-tertiary min-vh-100 d-flex flex-row align-items-center',
  },
})
export class CheckEmailComponent {
  private readonly api = inject(ProxyApiService)
  private readonly route = inject(ActivatedRoute)
  readonly email = signal('')
  readonly busy = signal(false)
  readonly message = signal('')
  readonly emailLabel = computed(() => this.email() || 'your email')

  constructor() {
    this.route.queryParamMap.subscribe(params => {
      const nextEmail = params.get('email') ?? localStorage.getItem('proxiedmail.pendingConfirmationEmail') ?? ''
      this.email.set(nextEmail)
    })
  }

  async resend() {
    if (!this.email()) return
    this.busy.set(true)
    this.message.set('')
    try {
      await this.api.resendConfirmation(this.email())
      this.message.set('Another confirmation email is on the way.')
    }
    catch (error) {
      this.message.set(error instanceof Error ? error.message : 'Unable to resend the confirmation email.')
    }
    finally {
      this.busy.set(false)
    }
  }
}
