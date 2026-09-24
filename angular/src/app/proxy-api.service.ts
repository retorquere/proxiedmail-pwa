import { HttpClient, HttpHeaders } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { firstValueFrom, Observable } from 'rxjs'

export interface Binding {
  id: string
  address: string
  description: string
  received: number
  callbackUrl: string
  usedOn: string[]
  password: string
  recipients: string[]
  states: Record<string, boolean>
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

export interface CustomDomain {
  domain: string
  [key: string]: any
}

@Injectable({ providedIn: 'root' })
export class ProxyApiService {
  private readonly apiOrigin = 'https://proxiedmail.com'
  private readonly http = inject(HttpClient)
  private headers(bearer = false) {
    const token = localStorage.getItem(bearer ? 'proxiedmail.bearerToken' : 'proxiedmail.apiToken')
    return new HttpHeaders({ Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { [bearer ? 'Authorization' : 'Token']: bearer ? `Bearer ${token}` : token } : {}) })
  }
  private request<T>(url: string, options: { method?: string; body?: unknown; bearer?: boolean } = {}): Observable<T> {
    return this.http.request<T>(options.method ?? 'GET', `${this.apiOrigin}${url}`, { body: options.body, headers: this.headers(options.bearer) })
  }
  private async finishLogin(bearer: string) {
    const tokenResponse = await firstValueFrom(this.request<any>('/api/v1/api-token', { bearer: true }))
    const apiToken = tokenResponse?.token ?? tokenResponse?.data?.attributes?.token
    if (!apiToken) throw new Error('The token response was incomplete.')
    localStorage.setItem('proxiedmail.bearerToken', bearer)
    localStorage.setItem('proxiedmail.apiToken', apiToken)
  }
  async login(token: string) {
    const bearer = token.trim().replace(/^Bearer\s+/i, '')
    if (!bearer) throw new Error('Enter a token.')
    localStorage.setItem('proxiedmail.bearerToken', bearer)
    try {
      await this.finishLogin(bearer)
    }
    catch (error) {
      localStorage.removeItem('proxiedmail.bearerToken')
      localStorage.removeItem('proxiedmail.apiToken')
      throw error
    }
  }
  logout() {
    localStorage.removeItem('proxiedmail.bearerToken')
    localStorage.removeItem('proxiedmail.apiToken')
  }
  async dashboard() {
    const [bindings, profile, domains, emails, usedOn, passwords, settings] = await Promise.all([firstValueFrom(this.request<any>('/api/v1/proxy-bindings?sort=desc')), firstValueFrom(this.request<any>('/api/v1/users/me')), firstValueFrom(this.request<any>('/gapi/available-domains', { bearer: true })), firstValueFrom(this.request<any>('/gapi/real-emails', { bearer: true })), firstValueFrom(this.request<any>('/gapi/used-on', { bearer: true })), firstValueFrom(this.request<any>('/gapi/passwords', { bearer: true })), firstValueFrom(this.request<any>('/gapi/settings', { bearer: true }))])
    const list = (bindings?.data ?? []).map((item: any): Binding => {
      const attributes = item.attributes ?? {}
      const map = attributes.real_addresses ?? {}
      const bindingUsedOn = (Array.isArray(usedOn) ? usedOn : usedOn?.data ?? []).find((entry: any) => (entry.proxy_binding_id ?? entry.related_to_id) === item.id)?.list ?? []
      const bindingPassword = (Array.isArray(passwords) ? passwords : passwords?.data ?? []).find((entry: any) => (entry.related_to_id ?? entry.proxy_binding_id) === item.id)?.password ?? ''
      return { id: item.id, address: attributes.proxy_address ?? '', description: attributes.description ?? '', received: attributes.received_emails ?? 0, callbackUrl: attributes.callback_url ?? '', usedOn: bindingUsedOn, password: bindingPassword, recipients: Object.keys(map), states: Object.fromEntries(Object.entries(map).map(([key, value]: any) => [key, value?.is_enabled !== false])) }
    })
    const settingList = Array.isArray(settings) ? settings : settings?.data ?? []
    return { bindings: list, available: bindings?.meta?.availableProxyBindings ?? 0, twoFactor: Boolean(profile?.data?.attributes?.two_factor_enabled ?? profile?.data?.attributes?.twoFactorEnabled), domains: (Array.isArray(domains) ? domains : domains?.data ?? []).map((item: any) => item.domain ?? item.name ?? item).filter(Boolean), emails: (Array.isArray(emails) ? emails : emails?.data ?? []).map((item: any) => item.email ?? item).filter(Boolean), defaultDomain: settingList.find((setting: any) => setting.key === 'random_alias_default_domain')?.value ?? '', passwordPreferences: { length: Number(settingList.find((setting: any) => setting.key === 'password_length')?.value) || 13, symbols: settingList.find((setting: any) => setting.key === 'use_symbols')?.value !== 'false', numbers: settingList.find((setting: any) => setting.key === 'use_numbers')?.value !== 'false', letters: settingList.find((setting: any) => setting.key === 'use_letters')?.value !== 'false' } }
  }
  async settingsData() {
    const [profile, domains, settings] = await Promise.all([firstValueFrom(this.request<any>('/api/v1/users/me')), firstValueFrom(this.request<any>('/gapi/available-domains', { bearer: true })), firstValueFrom(this.request<any>('/gapi/settings', { bearer: true }))])
    return { twoFactor: Boolean(profile?.data?.attributes?.two_factor_enabled ?? profile?.data?.attributes?.twoFactorEnabled), domains: (Array.isArray(domains) ? domains : domains?.data ?? []).map((item: any) => item.domain ?? item.name ?? item).filter(Boolean), settings: Array.isArray(settings) ? settings : settings?.data ?? [] }
  }
  async customDomains(): Promise<CustomDomain[]> {
    const response = await firstValueFrom(this.request<any>('/gapi/custom-domains?ignoreProcessing=1', { bearer: true }))
    const entries = Array.isArray(response) ? response : response?.data ?? []
    return entries.map((item: any): CustomDomain => ({ ...(item.attributes ?? item), domain: item.domain ?? item.attributes?.domain ?? '' })).filter((item: CustomDomain) => item.domain)
  }
  updateSettings(settings: { key: string; value: string }[]) {
    return this.request('/gapi/settings/update', { method: 'PATCH', bearer: true, body: { settings } })
  }
  removeTwoFactor() {
    return this.request('/api/v1/users/remove-2fa', { method: 'DELETE' })
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
}
