import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { firstValueFrom, Observable } from 'rxjs'

const settingsTargetAddress = 'settings@proxiedmail.internal'

export interface Binding {
  id: string
  address: string
  description: string
  browsable: boolean
  received: number
  callbackUrl: string
  usedOn: string[]
  password: string
  recipients: string[]
  states: Record<string, boolean>
  verificationStates: Record<string, boolean>
}

export interface ProxyContact {
  id: string
  recipientEmail: string
  reverseProxyAddress: string
}

export interface PasswordPreferences {
  length: number
  symbols: boolean
  numbers: boolean
  letters: boolean
}

export interface AccountStatus {
  email: string
  username: string
  confirmed: boolean
}

export interface CustomDomain {
  domain: string
  [key: string]: any
}

@Injectable({ providedIn: 'root' })
export class ProxyApiService {
  private readonly http = inject(HttpClient)
  private headers(bearer = false) {
    const bearerToken = localStorage.getItem('proxiedmail.bearerToken')
    const apiToken = localStorage.getItem('proxiedmail.apiToken')
    const auth: Record<string, string> = bearer && (bearerToken || apiToken) ? { Authorization: `Bearer ${bearerToken || apiToken}` } : apiToken ? { Token: apiToken } : {}
    return new HttpHeaders({ Accept: 'application/json', 'Content-Type': 'application/json', ...auth })
  }
  private request<T>(url: string, options: { method?: string; body?: unknown; bearer?: boolean } = {}): Observable<T> {
    return this.http.request<T>(options.method ?? 'GET', url, { body: options.body, headers: this.headers(options.bearer) })
  }
  async login(token: string) {
    const apiToken = token.trim().replace(/^Token\s+/i, '')
    if (!apiToken) throw new Error('Enter an API token.')
    if (/[\s()]/.test(apiToken)) throw new Error('Paste only the API token, without a label or surrounding text.')
    localStorage.setItem('proxiedmail.apiToken', apiToken)
    localStorage.removeItem('proxiedmail.bearerToken')
  }
  async register(username: string, password: string) {
    const email = username.trim()
    const suppliedPassword = password.trim()
    if (!email || !suppliedPassword) throw new Error('Enter an email and password to create your account.')
    await firstValueFrom(this.request('/api/v1/users', { method: 'POST', body: { data: { type: 'users', attributes: { username: email, password: suppliedPassword } } } }))
    localStorage.setItem('proxiedmail.pendingConfirmationEmail', email)
  }
  async currentUser(): Promise<AccountStatus> {
    const response = await firstValueFrom(this.request<any>('/api/v1/users/me'))
    const data = response?.data ?? response ?? {}
    const attributes = data.attributes ?? data ?? {}
    const email = String(attributes.email ?? data.email ?? localStorage.getItem('proxiedmail.pendingConfirmationEmail') ?? '').trim()
    const username = String(attributes.username ?? data.username ?? '').trim()
    const confirmed = this.parseConfirmed(attributes.confirmed ?? attributes.is_confirmed ?? attributes.email_confirmed ?? attributes.email_verified ?? data.confirmed ?? data.is_confirmed ?? true)
    return { email, username, confirmed }
  }
  private parseConfirmed(value: unknown): boolean {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (!normalized) return true
      if (['true', '1', 'yes', 'confirmed', 'verified', 'active', 'enabled', 'ok'].includes(normalized)) return true
      if (['false', '0', 'no', 'unconfirmed', 'pending', 'pending_confirmation', 'needs_confirmation', 'verification_required', 'disabled'].includes(normalized)) return false
    }
    return true
  }
  async resendConfirmation(email?: string) {
    const target = (email ?? (await this.currentUser()).email).trim()
    if (!target) throw new Error('No email address is available to resend confirmation.')
    return firstValueFrom(this.request('/api/v1/resend-confirmation', { method: 'POST', body: { data: { type: 'confirmation', attributes: { email: target } } } }))
  }
  logout() {
    localStorage.removeItem('proxiedmail.bearerToken')
    localStorage.removeItem('proxiedmail.apiToken')
  }
  async dashboard() {
    const bindings = await this.loadBindings()
    const [domains, customDomains, emails, usedOn, passwords, settings] = await Promise.all([
      this.optional(this.request<any>('/gapi/available-domains', { bearer: true }), []),
      this.optional(this.request<any>('/gapi/custom-domains?ignoreProcessing=1', { bearer: true }), []),
      this.optional(this.request<any>('/gapi/real-emails', { bearer: true }), []),
      this.optional(this.request<any>('/gapi/used-on', { bearer: true }), []),
      this.optional(this.request<any>('/gapi/passwords', { bearer: true }), []),
      this.optional(this.request<any>('/gapi/settings', { bearer: true }), []),
    ])
    const allBindings = (bindings?.data ?? []).map((item: any): Binding => {
      const attributes = item.attributes ?? {}
      const map = attributes.real_addresses ?? {}
      const entries = Object.entries(map)
      const bindingUsedOn = (Array.isArray(usedOn) ? usedOn : usedOn?.data ?? []).find((entry: any) => (entry.proxy_binding_id ?? entry.related_to_id) === item.id)?.list ?? []
      const bindingPassword = (Array.isArray(passwords) ? passwords : passwords?.data ?? []).find((entry: any) => (entry.related_to_id ?? entry.proxy_binding_id) === item.id)?.password ?? ''
      return { id: item.id, address: attributes.proxy_address ?? '', description: attributes.description ?? '', browsable: attributes.is_browsable === true, received: attributes.received_emails ?? 0, callbackUrl: attributes.callback_url ?? '', usedOn: bindingUsedOn, password: bindingPassword, recipients: Object.keys(map), states: Object.fromEntries(entries.map(([key, value]: any) => [key, value?.is_enabled !== false])), verificationStates: Object.fromEntries(entries.map(([key, value]: any) => [key, value?.is_verified === true])) }
    })
    const list = allBindings.filter((binding: Binding) => !this.isSettingsBinding(binding))
    const settingList = Array.isArray(settings) ? settings : settings?.data ?? []
    return { bindings: list, available: bindings?.meta?.availableProxyBindings ?? 0, domains: this.domainList(domains), customDomains: this.domainList(customDomains), emails: (Array.isArray(emails) ? emails : emails?.data ?? []).map((item: any) => item.email ?? item).filter(Boolean), defaultDomain: settingList.find((setting: any) => setting.key === 'random_alias_default_domain')?.value ?? '', passwordPreferences: { length: Number(settingList.find((setting: any) => setting.key === 'password_length')?.value) || 13, symbols: settingList.find((setting: any) => setting.key === 'use_symbols')?.value !== 'false', numbers: settingList.find((setting: any) => setting.key === 'use_numbers')?.value !== 'false', letters: settingList.find((setting: any) => setting.key === 'use_letters')?.value !== 'false' }, appSettings: this.appSettingsFromBindings(allBindings) }
  }
  private async loadBindings() {
    try {
      return await firstValueFrom(this.request<any>('/api/v1/proxy-bindings?sort=desc'))
    }
    catch (error) {
      const suppliedToken = localStorage.getItem('proxiedmail.apiToken')
      if (!(error instanceof HttpErrorResponse) || ![401, 403].includes(error.status) || !suppliedToken || localStorage.getItem('proxiedmail.bearerToken')) throw error
      try {
        const headers = new HttpHeaders({ Accept: 'application/json', Authorization: `Bearer ${suppliedToken}` })
        const response = await firstValueFrom(this.http.get<any>('/api/v1/api-token', { headers }))
        const apiToken = response?.token ?? response?.data?.attributes?.token
        if (!apiToken) throw new Error('The token response was incomplete.')
        localStorage.setItem('proxiedmail.bearerToken', suppliedToken)
        localStorage.setItem('proxiedmail.apiToken', apiToken)
        return await firstValueFrom(this.request<any>('/api/v1/proxy-bindings?sort=desc'))
      }
      catch {
        throw error
      }
    }
  }
  private async optional<T>(request: Observable<T>, fallback: T): Promise<T> {
    try {
      return await firstValueFrom(request)
    }
    catch {
      return fallback
    }
  }
  async settingsData() {
    const [domains, customDomains, emails, settings, bindings] = await Promise.all([firstValueFrom(this.request<any>('/gapi/available-domains', { bearer: true })), this.optional(this.request<any>('/gapi/custom-domains?ignoreProcessing=1', { bearer: true }), []), this.optional(this.request<any>('/gapi/real-emails', { bearer: true }), []), firstValueFrom(this.request<any>('/gapi/settings', { bearer: true })), this.optional(this.request<any>('/api/v1/proxy-bindings?sort=desc'), { data: [] })])
    const settingsBindings = this.settingsBindings(this.bindingList(bindings))
    await this.deleteDuplicateSettingsBindings(settingsBindings)
    return { domains: this.domainList(domains), customDomains: this.domainList(customDomains), targetAddresses: this.emailList(emails), settings: Array.isArray(settings) ? settings : settings?.data ?? [], appSettings: this.appSettingsFromBindings(settingsBindings) }
  }

  async saveAppSettings(settings: Record<string, string>, domains: string[], customDomains: string[]) {
    const binding = await this.ensureSettingsBinding(domains, customDomains)
    const merged = { ...this.parseAppSettings(binding.description), ...settings }
    await firstValueFrom(this.request(`/api/v1/proxy-bindings/${binding.id}`, { method: 'PATCH', body: { data: { id: binding.id, type: 'proxy_bindings', attributes: { proxy_address: binding.address, description: this.encodeAppSettings(merged), callback_url: '', real_addresses: { [settingsTargetAddress]: false } } } } }))
  }

  private domainList(response: any) {
    const entries = Array.isArray(response) ? response : response?.data ?? []
    return entries.map((item: any) => item?.domain ?? item?.name ?? item?.attributes?.domain ?? item?.attributes?.name ?? item).filter(Boolean)
  }

  private emailList(response: any) {
    const entries = Array.isArray(response) ? response : response?.data ?? []
    const emails = entries.map((item: any) => item?.email ?? item?.address ?? '').filter((email: string) => email && email !== settingsTargetAddress)
    return emails.filter((email: string, index: number) => emails.indexOf(email) === index)
  }

  private bindingList(response: any): Binding[] {
    return (response?.data ?? []).map((item: any): Binding => {
      const attributes = item.attributes ?? {}
      const map = attributes.real_addresses ?? {}
      const entries = Object.entries(map)
      return { id: item.id, address: attributes.proxy_address ?? '', description: attributes.description ?? '', browsable: attributes.is_browsable === true, received: attributes.received_emails ?? 0, callbackUrl: attributes.callback_url ?? '', usedOn: [], password: '', recipients: Object.keys(map), states: Object.fromEntries(entries.map(([key, value]: any) => [key, value?.is_enabled !== false])), verificationStates: Object.fromEntries(entries.map(([key, value]: any) => [key, value?.is_verified === true])) }
    })
  }

  private isSettingsBinding(binding: Binding) {
    return binding.recipients.includes(settingsTargetAddress)
  }

  private appSettingsFromBindings(bindings: Binding[]) {
    const binding = this.settingsBindings(bindings)[0]
    return binding ? this.parseAppSettings(binding.description) : {}
  }

  private parseAppSettings(description: string) {
    return Object.fromEntries(description.split(';').map(part => part.trim()).filter(part => part.includes(':')).map(part => {
      const [key, ...value] = part.split(':')
      return [key.trim(), value.join(':').trim()]
    }))
  }

  private encodeAppSettings(settings: Record<string, string>) {
    return Object.entries(settings).map(([key, value]) => `${key}: ${value}`).join('; ')
  }

  private async ensureSettingsBinding(domains: string[], customDomains: string[]) {
    const bindings = this.bindingList(await firstValueFrom(this.request<any>('/api/v1/proxy-bindings?sort=desc')))
    const existing = this.settingsBindings(bindings)
    if (existing.length) {
      await this.deleteDuplicateSettingsBindings(existing)
      return existing[0]
    }
    const domain = domains.find(item => !customDomains.includes(item)) ?? domains[0] ?? 'proxiedmail.com'
    await firstValueFrom(this.create(crypto.randomUUID(), domain, settingsTargetAddress))
    const created = this.bindingList(await firstValueFrom(this.request<any>('/api/v1/proxy-bindings?sort=desc'))).find(binding => this.isSettingsBinding(binding))
    if (!created) throw new Error('Could not create settings proxy.')
    return created
  }

  private settingsBindings(bindings: Binding[]) {
    return bindings.filter(binding => this.isSettingsBinding(binding)).sort((left, right) => left.id.localeCompare(right.id))
  }

  private async deleteDuplicateSettingsBindings(bindings: Binding[]) {
    await Promise.all(bindings.slice(1).map(binding => firstValueFrom(this.delete(binding)).catch(() => undefined)))
  }
  async exportConfiguration() {
    const dashboard = await this.dashboard()
    const settingsResponse = await this.optional(this.request<any>('/gapi/settings', { bearer: true }), [])
    const settingList = Array.isArray(settingsResponse) ? settingsResponse : settingsResponse?.data ?? []
    const proxies = await Promise.all(dashboard.bindings.map(async (binding: Binding) => {
      const contacts = await this.optionalContacts(binding)
      return {
        proxyAddress: binding.address,
        description: binding.description,
        callbackUrl: binding.callbackUrl,
        browsable: binding.browsable,
        targets: binding.recipients.map((address: string) => ({ address, enabled: binding.states[address] !== false })),
        usedOn: binding.usedOn,
        sitePassword: binding.password,
        contacts: contacts.map(contact => ({ recipientAddress: contact.recipientEmail, reverseProxyAddress: contact.reverseProxyAddress })),
      }
    }))
    return {
      format: 'proxiedmail-portable-config',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: Object.fromEntries(settingList.filter((setting: any) => setting?.key).map((setting: any) => [setting.key, setting.value])),
      appSettings: dashboard.appSettings,
      proxies,
    }
  }
  private async optionalContacts(binding: Binding): Promise<ProxyContact[]> {
    try {
      return await this.contacts(binding)
    }
    catch {
      return []
    }
  }
  async customDomains(): Promise<CustomDomain[]> {
    const response = await firstValueFrom(this.request<any>('/gapi/custom-domains?ignoreProcessing=1', { bearer: true }))
    const entries = Array.isArray(response) ? response : response?.data ?? []
    return entries.map((item: any): CustomDomain => ({ ...(item.attributes ?? item), domain: item.domain ?? item.attributes?.domain ?? '' })).filter((item: CustomDomain) => item.domain)
  }
  updateSettings(settings: { key: string; value: string }[]) {
    return this.request('/gapi/settings/update', { method: 'PATCH', bearer: true, body: { settings } })
  }
  apiToken() {
    return localStorage.getItem('proxiedmail.apiToken') ?? ''
  }
  create(alias: string, domain: string, forwarding: string) {
    return this.request('/api/v1/proxy-bindings', { method: 'POST', body: { data: { type: 'proxy_bindings', attributes: { proxy_address: `${alias}@${domain}`, real_addresses: forwarding.split(',').map(item => item.trim()).filter(Boolean), is_browsable: false } } } })
  }
  update(binding: Binding, changes: { forwarding: string; description: string; callbackUrl: string }) {
    return this.request(`/api/v1/proxy-bindings/${binding.id}`, { method: 'PATCH', body: { data: { id: binding.id, type: 'proxy_bindings', attributes: { proxy_address: binding.address, description: changes.description, callback_url: changes.callbackUrl, real_addresses: Object.fromEntries(changes.forwarding.split(',').map(item => item.trim()).filter(Boolean).map(address => [address, binding.states[address] ?? true])) } } } })
  }
  delete(binding: Binding) {
    return this.request(`/api/v1/proxy-bindings/${binding.id}`, { method: 'DELETE' })
  }
  async contacts(binding: Binding): Promise<ProxyContact[]> {
    const response = await firstValueFrom(this.request<any>(`/api/v1/proxy-bindings/${binding.id}/contacts`))
    const entries = Array.isArray(response) ? response : response?.data ?? []
    return entries.map((entry: any): ProxyContact => ({ id: entry.id, recipientEmail: entry.attributes?.recipient_email ?? '', reverseProxyAddress: entry.attributes?.reverse_proxy_address ?? '' }))
  }
  createContact(binding: Binding, recipientEmail: string) {
    return this.request(`/api/v1/contacts`, { method: 'POST', body: { data: { type: 'proxy_binding_contacts', attributes: { recipient_email: recipientEmail }, relationships: { proxy_binding: { data: { type: 'proxy_bindings', id: binding.id } } } } } })
  }
  updateUsedOn(binding: Binding, list: string[]) {
    return this.request('/gapi/used-on', { method: 'PATCH', bearer: true, body: { proxy_binding_id: binding.id, list } })
  }
  setBindingPassword(binding: Binding, password: string) {
    return this.request('/gapi/passwords/proxy-binding', { method: 'PATCH', bearer: true, body: { proxy_binding_id: binding.id, password } })
  }
  setRecipient(binding: Binding, address: string, enabled: boolean) {
    return this.request(`/api/v1/proxy-bindings/${binding.id}`, { method: 'PATCH', body: { data: { id: binding.id, type: 'proxy_bindings', attributes: { proxy_address: binding.address, real_addresses: { [address]: enabled } } } } })
  }
  replaceTargetAddress(oldEmail: string, newEmail: string) {
    return this.request('/api/v1/emails/replace', { method: 'POST', body: { data: { type: 'replace-real-emails', attributes: { oldEmail, newEmail } } } })
  }
}
