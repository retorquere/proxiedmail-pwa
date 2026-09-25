import { CommonModule } from '@angular/common'
import { Component, inject, OnInit, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ButtonDirective, CardBodyComponent, CardComponent, ColComponent, FormCheckComponent, FormCheckInputDirective, FormCheckLabelDirective, FormSelectDirective, RowComponent, SpinnerComponent } from '@coreui/angular'
import { currentLocale, setLocale, SupportedLocale } from '../../../locale/runtime'
import { ProxyApiService } from '../../proxy-api.service'

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  imports: [CommonModule, FormsModule, ButtonDirective, CardBodyComponent, CardComponent, ColComponent, FormCheckComponent, FormCheckInputDirective, FormCheckLabelDirective, FormSelectDirective, RowComponent, SpinnerComponent],
})
export class SettingsComponent implements OnInit {
  readonly api = inject(ProxyApiService)
  readonly loading = signal(true)
  readonly saving = signal(false)
  readonly message = signal('')
  readonly error = signal('')
  readonly hideIamRich = signal(this.readPreference('proxiedmail.hideIamRich'))
  readonly onlyCustomDomains = signal(this.readPreference('proxiedmail.onlyCustomDomains'))
  readonly removeMailInfoBanner = signal(false)
  readonly retention = signal('never')
  readonly domains = signal<string[]>([])
  readonly customDomains = signal<string[]>([])
  readonly targetAddresses = signal<string[]>([])
  readonly selectedDomain = signal('')
  readonly selectedTargetAddress = signal('')
  readonly replacementTargetAddress = signal('')
  readonly passwordLength = signal(13)
  readonly useSymbols = signal(true)
  readonly useNumbers = signal(true)
  readonly useLetters = signal(true)
  readonly bitwardenVisible = signal(false)
  readonly exporting = signal(false)
  readonly replacingTarget = signal(false)
  readonly locale = signal<SupportedLocale>(currentLocale())
  get availableDomains() {
    return this.domains().filter(domain => !(this.hideIamRich() && domain === 'iam-rich.net'))
  }
  get hasCustomDomains() {
    return this.customDomains().length > 0
  }
  get availableCustomDomains() {
    return this.customDomains().filter(domain => this.availableDomains.includes(domain))
  }

  ngOnInit() {
    this.load()
  }

  async load() {
    this.loading.set(true)
    this.error.set('')
    try {
      const data = await this.api.settingsData()
      this.domains.set(data.domains)
      this.customDomains.set(data.customDomains)
      this.targetAddresses.set(data.targetAddresses)
      this.selectedTargetAddress.set(data.targetAddresses[0] ?? '')
      if (!data.customDomains.length) this.onlyCustomDomains.set(false)
      if (this.availableDomains.length) this.selectedDomain.set(this.availableDomains[0])
      const retentionSetting = data.settings.find((setting: any) => /retention|message/i.test(setting.key ?? ''))
      if (retentionSetting?.value) this.retention.set(retentionSetting.value)
      const setting = (key: string) => data.settings.find((entry: any) => entry.key === key)?.value
      this.removeMailInfoBanner.set(setting('hide_banner') === 'hide')
      if (setting('password_length')) this.passwordLength.set(Number(setting('password_length')) || 13)
      this.useSymbols.set(setting('use_symbols') !== 'false')
      this.useNumbers.set(setting('use_numbers') !== 'false')
      this.useLetters.set(setting('use_letters') !== 'false')
      if (this.availableDomains.includes(setting('random_alias_default_domain'))) this.selectedDomain.set(setting('random_alias_default_domain'))
    }
    catch (error) {
      this.error.set(error instanceof Error ? error.message : $localize`Unable to load settings.`)
    }
    finally {
      this.loading.set(false)
    }
  }

  saveLocalPreference() {
    this.writeCookie('proxiedmail.hideIamRich', String(this.hideIamRich()))
    localStorage.setItem('proxiedmail.hideIamRich', String(this.hideIamRich()))
    if (!this.availableDomains.includes(this.selectedDomain())) this.selectedDomain.set(this.availableDomains[0] ?? '')
  }
  saveOnlyCustomDomainsPreference() {
    if (!this.hasCustomDomains) return
    this.writeCookie('proxiedmail.onlyCustomDomains', String(this.onlyCustomDomains()))
    localStorage.setItem('proxiedmail.onlyCustomDomains', String(this.onlyCustomDomains()))
    if (this.onlyCustomDomains() && !this.customDomains().includes(this.selectedDomain()) && this.availableCustomDomains.length) {
      this.selectedDomain.set(this.availableCustomDomains[0])
      this.saveDefaultDomain()
    }
  }
  async saveMailInfoPreference() {
    this.error.set('')
    try {
      await this.api.updateSettings([{ key: 'hide_banner', value: this.removeMailInfoBanner() ? 'hide' : 'keep' }]).toPromise()
      this.message.set($localize`Settings saved.`)
    }
    catch (error) {
      this.error.set(error instanceof Error ? error.message : $localize`Unable to save settings.`)
    }
  }

  savePasswordPreferences() {
    this.api.updateSettings([
      { key: 'password_length', value: String(this.passwordLength()) },
      { key: 'use_symbols', value: String(this.useSymbols()) },
      { key: 'use_numbers', value: String(this.useNumbers()) },
      { key: 'use_letters', value: String(this.useLetters()) },
    ]).subscribe()
  }

  saveDefaultDomain() {
    this.api.updateSettings([{ key: 'random_alias_default_domain', value: this.selectedDomain() }]).subscribe()
  }

  changeLocale() {
    setLocale(this.locale())
  }

  async downloadConfiguration() {
    this.exporting.set(true)
    this.error.set('')
    try {
      const configuration = await this.api.exportConfiguration()
      const blob = new Blob([JSON.stringify(configuration, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `proxiedmail-config-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      this.message.set($localize`Configuration downloaded.`)
    }
    catch (error) {
      this.error.set(error instanceof Error ? error.message : $localize`Unable to export configuration.`)
    }
    finally {
      this.exporting.set(false)
    }
  }

  async saveRetention() {
    this.saving.set(true)
    this.message.set('')
    this.error.set('')
    try {
      await this.api.updateSettings([{ key: 'received_messages_retention', value: this.retention() }]).toPromise()
      this.message.set($localize`Settings saved.`)
    }
    catch (error) {
      this.error.set(error instanceof Error ? error.message : $localize`Unable to save settings.`)
    }
    finally {
      this.saving.set(false)
    }
  }

  async replaceTargetAddress() {
    const oldEmail = this.selectedTargetAddress().trim()
    const newEmail = this.replacementTargetAddress().trim()
    if (!oldEmail || !newEmail) return
    this.replacingTarget.set(true)
    this.message.set('')
    this.error.set('')
    try {
      await this.api.replaceTargetAddress(oldEmail, newEmail).toPromise()
      this.replacementTargetAddress.set('')
      this.message.set($localize`Target address replacement started.`)
    }
    catch (error) {
      this.error.set(error instanceof Error ? error.message : $localize`Unable to replace target address.`)
    }
    finally {
      this.replacingTarget.set(false)
    }
  }

  private readCookie(name: string) {
    return document.cookie.split('; ').some(cookie => cookie === `${name}=true`)
  }
  private readPreference(name: string) {
    const cookieValue = document.cookie.split('; ').find(cookie => cookie.startsWith(`${name}=`))?.split('=').slice(1).join('=')
    const storedValue = localStorage.getItem(name)
    return [cookieValue, storedValue].some(value => ['true', '1', 'on'].includes(value?.toLowerCase() ?? ''))
  }

  private writeCookie(name: string, value: string) {
    document.cookie = `${name}=${value}; Max-Age=31536000; Path=/; SameSite=Lax`
  }
}
