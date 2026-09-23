import { CommonModule } from '@angular/common'
import { Component, inject, OnInit, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ButtonDirective, CardBodyComponent, CardComponent, ColComponent, FormControlDirective, FormSelectDirective, RowComponent, SpinnerComponent } from '@coreui/angular'
import { Binding, ProxyApiService } from '../../proxy-api.service'
import { ProxyBindingCardComponent } from './proxy-binding-card/proxy-binding-card.component'

@Component({ templateUrl: 'dashboard.component.html', styleUrls: ['dashboard.component.scss'], imports: [CommonModule, FormsModule, CardComponent, CardBodyComponent, ColComponent, RowComponent, ButtonDirective, FormControlDirective, FormSelectDirective, SpinnerComponent, ProxyBindingCardComponent] })
export class DashboardComponent implements OnInit {
  private readonly api = inject(ProxyApiService)
  readonly bindings = signal<Binding[]>([])
  readonly domains = signal<string[]>([])
  readonly emails = signal<string[]>([])
  readonly passwordPreferences = signal({ length: 13, symbols: true, numbers: true, letters: true })
  readonly available = signal(0)
  readonly twoFactor = signal(false)
  readonly query = signal('')
  readonly heroVisible = signal(localStorage.getItem('proxiedmail.hideDashboardHero') !== 'true')
  readonly alias = signal('')
  readonly domain = signal('')
  readonly forwarding = signal('')
  readonly forwardingQuery = signal('')
  readonly forwardingOpen = signal(false)
  readonly loading = signal(false)
  get filtered() {
    const query = this.query().toLowerCase()
    return this.bindings().filter(binding => `${binding.address} ${binding.description}`.toLowerCase().includes(query))
  }
  get filteredEmails() {
    const query = this.forwardingQuery().trim().toLowerCase()
    return this.emails().filter(email => email.toLowerCase().includes(query))
  }
  twoFactorLabel() {
    return this.twoFactor() ? $localize`On` : $localize`Off`
  }
  fallbackDescription() {
    return $localize`Private forwarding address`
  }
  ngOnInit() {
    this.refresh()
  }
  async refresh() {
    const startedAt = performance.now()
    this.loading.set(true)
    try {
      const data = await this.api.dashboard()
      this.bindings.set(data.bindings)
      this.domains.set(data.domains.filter((domain: string) => !(domain === 'iam-rich.net' && this.hideIamRichPreference())))
      this.emails.set(data.emails)
      this.available.set(data.available)
      this.twoFactor.set(data.twoFactor)
      this.passwordPreferences.set(data.passwordPreferences)
      if (!this.domain()) this.domain.set(data.domains.includes(data.defaultDomain) ? data.defaultDomain : data.domains[0] ?? '')
    }
    finally {
      const remaining = 500 - (performance.now() - startedAt)
      if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining))
      this.loading.set(false)
    }
  }
  create() {
    if (!this.alias().trim() || !this.forwarding().trim()) return
    this.api.create(this.alias(), this.domain(), this.forwarding()).subscribe({
      next: () => {
        this.alias.set('')
        this.forwarding.set('')
        this.forwardingQuery.set('')
        this.refresh()
      },
    })
  }
  onForwardingInput(value: string) {
    this.forwardingQuery.set(value)
    this.forwarding.set('')
    this.forwardingOpen.set(true)
  }
  openForwarding() {
    this.forwardingOpen.set(true)
  }
  closeForwarding() {
    this.forwardingOpen.set(false)
  }
  selectForwarding(email?: string) {
    if (!email) return
    this.forwarding.set(email)
    this.forwardingQuery.set(email)
    this.forwardingOpen.set(false)
  }
  generateAlias() {
    const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    this.alias.set(Array.from({ length: 10 }, () => characters[Math.floor(Math.random() * characters.length)]).join(''))
  }
  private hideIamRichPreference() {
    const cookieValue = document.cookie.split('; ').find(cookie => cookie.startsWith('proxiedmail.hideIamRich='))?.split('=').slice(1).join('=')
    const storedValue = localStorage.getItem('proxiedmail.hideIamRich')
    return [cookieValue, storedValue].some(value => ['true', '1', 'on'].includes(value?.toLowerCase() ?? ''))
  }
  dismissHero() {
    this.heroVisible.set(false)
    localStorage.setItem('proxiedmail.hideDashboardHero', 'true')
  }
}
