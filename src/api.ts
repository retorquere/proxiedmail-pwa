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

export interface ProxyContact { id: string; recipientEmail: string; reverseProxyAddress: string }
export interface CustomDomain { domain: string; [key: string]: unknown }
export interface PasswordPreferences { length: number; symbols: boolean; numbers: boolean; letters: boolean }

const settingsTargetAddress = 'settings@proxiedmail.internal'
const tokenKey = 'proxiedmail.apiToken'
const bearerKey = 'proxiedmail.bearerToken'

function headers(bearer = false): HeadersInit {
  const apiToken = localStorage.getItem(tokenKey)
  const bearerToken = localStorage.getItem(bearerKey)
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(bearer && (bearerToken || apiToken) ? { Authorization: `Bearer ${bearerToken || apiToken}` } : apiToken ? { Token: apiToken } : {}),
  }
}

async function request<T>(url: string, options: RequestInit & { bearer?: boolean } = {}): Promise<T> {
  const response = await fetch(url, { ...options, headers: { ...headers(options.bearer), ...options.headers } })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string; detail?: string }
    throw new Error(body.message || body.detail || `${response.status} ${response.statusText}`)
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

function domainList(response: unknown): string[] {
  const entries = Array.isArray(response) ? response : (response as { data?: unknown[] })?.data || []
  return entries.map((item: any) => item?.domain || item?.name || item?.attributes?.domain || item?.attributes?.name || item).filter(Boolean)
}

function emailList(response: unknown): string[] {
  const entries = Array.isArray(response) ? response : (response as { data?: unknown[] })?.data || []
  return [...new Set(entries.map((item: any) => item?.email || item?.address || '').filter((email: string) => email && email !== settingsTargetAddress))]
}

function bindingList(response: any): Binding[] {
  return (response?.data || []).map((item: any) => {
    const attributes = item.attributes || {}
    const addresses = attributes.real_addresses || {}
    const entries = Object.entries(addresses)
    return {
      id: String(item.id), address: attributes.proxy_address || '', description: attributes.description || '', browsable: attributes.is_browsable === true,
      received: attributes.received_emails || 0, callbackUrl: attributes.callback_url || '', usedOn: [], password: '', recipients: Object.keys(addresses),
      states: Object.fromEntries(entries.map(([key, value]: any) => [key, value?.is_enabled !== false])),
      verificationStates: Object.fromEntries(entries.map(([key, value]: any) => [key, value?.is_verified === true])),
    }
  })
}

function isSettingsBinding(binding: Binding): boolean { return binding.recipients.includes(settingsTargetAddress) }

function parseAppSettings(description: string): Record<string, string> {
  return Object.fromEntries(description.split(';').map(part => part.trim()).filter(part => part.includes(':')).map(part => {
    const [key, ...value] = part.split(':')
    return [key.trim(), value.join(':').trim()]
  }))
}

function encodeAppSettings(settings: Record<string, string>): string {
  return Object.entries(settings).map(([key, value]) => `${key}: ${value}`).join('; ')
}

async function optional<T>(call: Promise<T>, fallback: T): Promise<T> { try { return await call } catch { return fallback } }

export const api = {
  isAuthenticated: () => Boolean(localStorage.getItem(tokenKey)),
  apiToken: () => localStorage.getItem(tokenKey) || '',
  async login(value: string) {
    const token = value.trim().replace(/^Token\s+/i, '')
    if (!token) throw new Error('Enter an API token.')
    if (/[\s()]/.test(token)) throw new Error('Paste only the API token, without a label or surrounding text.')
    localStorage.setItem(tokenKey, token); localStorage.removeItem(bearerKey)
  },
  logout() { localStorage.removeItem(tokenKey); localStorage.removeItem(bearerKey) },
  async currentUser() {
    const response = await request<any>('/api/v1/users/me')
    const data = response?.data || response || {}; const attributes = data.attributes || data
    const value = attributes.confirmed ?? attributes.is_confirmed ?? attributes.email_confirmed ?? true
    const confirmed = typeof value === 'string' ? !['false', '0', 'no', 'unconfirmed', 'pending'].includes(value.toLowerCase()) : Boolean(value)
    return { email: String(attributes.email || data.email || ''), username: String(attributes.username || data.username || ''), confirmed }
  },
  async dashboard() {
    let bindingsResponse: any
    try { bindingsResponse = await request('/api/v1/proxy-bindings?sort=desc') }
    catch (error) {
      const supplied = localStorage.getItem(tokenKey)
      if (!supplied || localStorage.getItem(bearerKey)) throw error
      const exchange = await request<any>('/api/v1/api-token', { headers: { Authorization: `Bearer ${supplied}` } }).catch(() => null)
      if (!exchange?.token && !exchange?.data?.attributes?.token) throw error
      localStorage.setItem(bearerKey, supplied); localStorage.setItem(tokenKey, exchange.token || exchange.data.attributes.token)
      bindingsResponse = await request('/api/v1/proxy-bindings?sort=desc')
    }
    const [domains, customDomains, emails, usedOn, passwords, settings] = await Promise.all([
      optional(request('/gapi/available-domains', { bearer: true }), []), optional(request('/gapi/custom-domains?ignoreProcessing=1', { bearer: true }), []),
      optional(request('/gapi/real-emails', { bearer: true }), []), optional(request<any>('/gapi/used-on', { bearer: true }), []),
      optional(request<any>('/gapi/passwords', { bearer: true }), []), optional(request<any>('/gapi/settings', { bearer: true }), []),
    ])
    const used = Array.isArray(usedOn) ? usedOn : usedOn?.data || []; const passwordList = Array.isArray(passwords) ? passwords : passwords?.data || []
    const allBindings = bindingList(bindingsResponse)
    const settingsBinding = allBindings.filter(isSettingsBinding).sort((left, right) => left.id.localeCompare(right.id))[0]
    const bindings = allBindings.filter(binding => !isSettingsBinding(binding)).map(binding => ({ ...binding,
      usedOn: used.find((item: any) => (item.proxy_binding_id || item.related_to_id) === binding.id)?.list || [],
      password: passwordList.find((item: any) => (item.related_to_id || item.proxy_binding_id) === binding.id)?.password || '',
    }))
    const settingList = Array.isArray(settings) ? settings : settings?.data || []
    const setting = (key: string) => settingList.find((item: any) => item.key === key)?.value
    return { bindings, domains: domainList(domains), customDomains: domainList(customDomains), emails: emailList(emails), available: bindingsResponse?.meta?.availableProxyBindings || 0, appSettings: settingsBinding ? parseAppSettings(settingsBinding.description) : {},
      settings: settingList, passwordPreferences: { length: Number(setting('password_length')) || 13, symbols: setting('use_symbols') !== 'false', numbers: setting('use_numbers') !== 'false', letters: setting('use_letters') !== 'false' } }
  },
  async exportConfiguration() {
    const dashboard = await api.dashboard()
    const proxies = await Promise.all(dashboard.bindings.map(async binding => {
      const contacts = await optional(api.contacts(binding), [])
      return {
        proxyAddress: binding.address,
        description: binding.description,
        callbackUrl: binding.callbackUrl,
        browsable: binding.browsable,
        targets: binding.recipients.map(address => ({ address, enabled: binding.states[address] !== false })),
        usedOn: binding.usedOn,
        sitePassword: binding.password,
        contacts: contacts.map(contact => ({ recipientAddress: contact.recipientEmail, reverseProxyAddress: contact.reverseProxyAddress })),
      }
    }))
    return {
      format: 'proxiedmail-portable-config',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: Object.fromEntries(dashboard.settings.filter((setting: any) => setting?.key).map((setting: any) => [setting.key, setting.value])),
      appSettings: dashboard.appSettings,
      proxies,
    }
  },
  async saveAppSettings(settings: Record<string, string>, domains: string[], customDomains: string[]) {
    const bindingsResponse = await request('/api/v1/proxy-bindings?sort=desc')
    const settingsBindings = bindingList(bindingsResponse).filter(isSettingsBinding).sort((left, right) => left.id.localeCompare(right.id))
    let binding = settingsBindings[0]

    if (binding) {
      await Promise.all(settingsBindings.slice(1).map(duplicate => request(`/api/v1/proxy-bindings/${duplicate.id}`, { method: 'DELETE' }).catch(() => undefined)))
    } else {
      const domain = domains.find(item => !customDomains.includes(item)) || domains[0] || 'proxiedmail.com'
      await request('/api/v1/proxy-bindings', { method: 'POST', body: JSON.stringify({ data: { type: 'proxy_bindings', attributes: { proxy_address: `${crypto.randomUUID()}@${domain}`, real_addresses: [settingsTargetAddress], is_browsable: false } } }) })
      const refreshed = bindingList(await request('/api/v1/proxy-bindings?sort=desc')).filter(isSettingsBinding).sort((left, right) => left.id.localeCompare(right.id))
      binding = refreshed[0]
      if (!binding) throw new Error('Could not create settings proxy.')
    }

    const description = encodeAppSettings({ ...parseAppSettings(binding.description), ...settings })
    return request(`/api/v1/proxy-bindings/${binding.id}`, { method: 'PATCH', body: JSON.stringify({ data: { id: binding.id, type: 'proxy_bindings', attributes: { proxy_address: binding.address, description, callback_url: '', real_addresses: { [settingsTargetAddress]: false } } } }) })
  },
  create(alias: string, domain: string, forwarding: string) { return request('/api/v1/proxy-bindings', { method: 'POST', body: JSON.stringify({ data: { type: 'proxy_bindings', attributes: { proxy_address: `${alias}@${domain}`, real_addresses: forwarding.split(',').map(item => item.trim()).filter(Boolean), is_browsable: false } } }) }) },
  update(binding: Binding, changes: { forwarding: string; description: string; callbackUrl: string }) { return request(`/api/v1/proxy-bindings/${binding.id}`, { method: 'PATCH', body: JSON.stringify({ data: { id: binding.id, type: 'proxy_bindings', attributes: { proxy_address: binding.address, description: changes.description, callback_url: changes.callbackUrl, real_addresses: Object.fromEntries(changes.forwarding.split(',').map(item => item.trim()).filter(Boolean).map(address => [address, binding.states[address] ?? true])) } } }) }) },
  delete(binding: Binding) { return request(`/api/v1/proxy-bindings/${binding.id}`, { method: 'DELETE' }) },
  setRecipient(binding: Binding, address: string, enabled: boolean) { return request(`/api/v1/proxy-bindings/${binding.id}`, { method: 'PATCH', body: JSON.stringify({ data: { id: binding.id, type: 'proxy_bindings', attributes: { proxy_address: binding.address, real_addresses: { [address]: enabled } } } }) }) },
  contacts: async (binding: Binding): Promise<ProxyContact[]> => { const response = await request<any>(`/api/v1/proxy-bindings/${binding.id}/contacts`); const entries = Array.isArray(response) ? response : response?.data || []; return entries.map((item: any) => ({ id: item.id, recipientEmail: item.attributes?.recipient_email || '', reverseProxyAddress: item.attributes?.reverse_proxy_address || '' })) },
  createContact(binding: Binding, recipientEmail: string) { return request('/api/v1/contacts', { method: 'POST', body: JSON.stringify({ data: { type: 'proxy_binding_contacts', attributes: { recipient_email: recipientEmail }, relationships: { proxy_binding: { data: { type: 'proxy_bindings', id: binding.id } } } } }) }) },
  updateSettings(settings: { key: string; value: string }[]) { return request('/gapi/settings/update', { method: 'PATCH', bearer: true, body: JSON.stringify({ settings }) }) },
  customDomains: async (): Promise<CustomDomain[]> => { const response = await request<any>('/gapi/custom-domains?ignoreProcessing=1', { bearer: true }); const entries = Array.isArray(response) ? response : response?.data || []; return entries.map((item: any) => ({ ...(item.attributes || item), domain: item.domain || item.attributes?.domain || '' })).filter((item: CustomDomain) => item.domain) },
  replaceTargetAddress(oldEmail: string, newEmail: string) { return request('/api/v1/emails/replace', { method: 'POST', body: JSON.stringify({ data: { type: 'replace-real-emails', attributes: { oldEmail, newEmail } } }) }) },
  updateUsedOn(binding: Binding, list: string[]) { return request('/gapi/used-on', { method: 'PATCH', bearer: true, body: JSON.stringify({ proxy_binding_id: binding.id, list }) },) },
  setBindingPassword(binding: Binding, password: string) { return request('/gapi/passwords/proxy-binding', { method: 'PATCH', bearer: true, body: JSON.stringify({ proxy_binding_id: binding.id, password }) }) },
}
