import { CommonModule } from '@angular/common'
import { Component, inject, signal } from '@angular/core'
import { FormsModule, NgForm } from '@angular/forms'
import { Router, RouterLink } from '@angular/router'
import { ButtonDirective, CardBodyComponent, CardComponent, ColComponent, ContainerComponent, FormCheckComponent, FormCheckInputDirective, FormCheckLabelDirective, FormControlDirective, FormDirective, FormLabelDirective, InputGroupComponent, InputGroupTextDirective, RowComponent, RowDirective, TooltipDirective } from '@coreui/angular'
import { IconDirective } from '@coreui/icons-angular'
import { ProxyApiService } from '../../../proxy-api.service'

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  host: {
    class: 'bg-body-tertiary min-vh-100 d-flex flex-row align-items-center',
  },
  imports: [
    ButtonDirective,
    CardBodyComponent,
    CardComponent,
    ColComponent,
    CommonModule,
    ContainerComponent,
    FormCheckComponent,
    FormCheckInputDirective,
    FormCheckLabelDirective,
    FormControlDirective,
    FormDirective,
    FormLabelDirective,
    FormsModule,
    IconDirective,
    InputGroupComponent,
    InputGroupTextDirective,
    RouterLink,
    RowComponent,
    RowDirective,
    TooltipDirective,
  ],
})
export class RegisterComponent {
  private readonly api = inject(ProxyApiService)
  readonly #router = inject(Router)
  readonly busy = signal(false)
  readonly error = signal('')

  protected async handleSubmit(f: NgForm): Promise<void> {
    if (!f.valid) return
    const email = String(f.value.email ?? '').trim()
    const password = String(f.value.password ?? '').trim()
    if (!email || !password) {
      this.error.set('Enter an email and password to create your account.')
      return
    }
    this.busy.set(true)
    this.error.set('')
    try {
      await this.api.register(email, password)
      await this.#router.navigate(['/authentication/check-email'], { queryParams: { email } })
    }
    catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to create the account.')
    }
    finally {
      this.busy.set(false)
    }
  }
}
