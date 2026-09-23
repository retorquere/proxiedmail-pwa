import { CommonModule } from '@angular/common'
import { Component, inject, OnInit, signal } from '@angular/core'
import { CardBodyComponent, CardComponent, ColComponent, RowComponent, SpinnerComponent } from '@coreui/angular'
import { CustomDomain, ProxyApiService } from '../../proxy-api.service'

@Component({
  selector: 'app-domains',
  templateUrl: './domains.component.html',
  styleUrls: ['./domains.component.scss'],
  imports: [CommonModule, CardBodyComponent, CardComponent, ColComponent, RowComponent, SpinnerComponent],
})
export class DomainsComponent implements OnInit {
  private readonly api = inject(ProxyApiService)
  readonly domains = signal<CustomDomain[]>([])
  readonly loading = signal(true)
  readonly error = signal('')

  ngOnInit() {
    this.load()
  }

  async load() {
    try {
      this.domains.set(await this.api.customDomains())
    }
    catch (error) {
      this.error.set(error instanceof Error ? error.message : $localize`Unable to load custom domains.`)
    }
    finally {
      this.loading.set(false)
    }
  }
  checkValue(domain: CustomDomain, keys: string[]) {
    const value = keys.map(key => domain[key]).find(value => value !== undefined && value !== null && value !== '')
    if (value === undefined) return $localize`Not reported`
    if (typeof value === 'boolean') return value ? $localize`Verified` : $localize`Not verified`
    return String(value)
  }
  checkClass(domain: CustomDomain, keys: string[]) {
    const value = this.checkValue(domain, keys).toLowerCase()
    return value === 'verified' || value === 'true' || value === 'active' || value === '1' ? 'check-ok' : ''
  }
}
