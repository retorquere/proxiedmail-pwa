import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';

export interface Binding {
  id: string;
  address: string;
  description: string;
  received: number;
  browsable: boolean;
  recipients: string[];
  states: Record<string, boolean>;
}

@Injectable({ providedIn: 'root' })
export class ProxyApiService {
  private readonly http = inject(HttpClient);
  private headers(bearer = false) {
    const token = localStorage.getItem(bearer ? 'proxiedmail.bearerToken' : 'proxiedmail.apiToken');
    return new HttpHeaders({ Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { [bearer ? 'Authorization' : 'Token']: bearer ? `Bearer ${token}` : token } : {}) });
  }
  private request<T>(url: string, options: { method?: string; body?: unknown; bearer?: boolean } = {}): Observable<T> { return this.http.request<T>(options.method ?? 'GET', url, { body: options.body, headers: this.headers(options.bearer) }); }
  async login(username: string, password: string) {
    const auth = await firstValueFrom(this.request<any>('/api/v1/auth', { method: 'POST', body: { data: { type: 'auth-request', attributes: { username, password } } } }));
    const bearer = auth?.data?.attributes?.token;
    if (bearer) localStorage.setItem('proxiedmail.bearerToken', bearer);
    const tokenResponse = await firstValueFrom(this.request<any>('/api/v1/api-token', { bearer: true }));
    const apiToken = tokenResponse?.token ?? tokenResponse?.data?.attributes?.token;
    if (!bearer || !apiToken) throw new Error('The token response was incomplete.');
    localStorage.setItem('proxiedmail.bearerToken', bearer);
    localStorage.setItem('proxiedmail.apiToken', apiToken);
  }

  logout() { localStorage.removeItem('proxiedmail.bearerToken'); localStorage.removeItem('proxiedmail.apiToken'); }
  async dashboard() {
    const [bindings, profile, domains, emails] = await Promise.all([firstValueFrom(this.request<any>('/api/v1/proxy-bindings?sort=desc')), firstValueFrom(this.request<any>('/api/v1/users/me')), firstValueFrom(this.request<any>('/gapi/available-domains', { bearer: true })), firstValueFrom(this.request<any>('/gapi/real-emails', { bearer: true }))]);
    const list = (bindings?.data ?? []).map((item: any): Binding => { const attributes = item.attributes ?? {}; const map = attributes.real_addresses ?? {}; return { id: item.id, address: attributes.proxy_address ?? '', description: attributes.description ?? '', received: attributes.received_emails ?? 0, browsable: attributes.is_browsable === true, recipients: Object.keys(map), states: Object.fromEntries(Object.entries(map).map(([key, value]: any) => [key, value?.is_enabled !== false])) }; });
    return { bindings: list, available: bindings?.meta?.availableProxyBindings ?? 0, twoFactor: Boolean(profile?.data?.attributes?.two_factor_enabled ?? profile?.data?.attributes?.twoFactorEnabled), domains: (Array.isArray(domains) ? domains : domains?.data ?? []).map((item: any) => item.domain ?? item.name ?? item).filter(Boolean), emails: (Array.isArray(emails) ? emails : emails?.data ?? []).map((item: any) => item.email ?? item).filter(Boolean) };
  }
  create(alias: string, domain: string, forwarding: string) { return this.request('/api/v1/proxy-bindings', { method: 'POST', body: { data: { type: 'proxy_bindings', attributes: { proxy_address: `${alias}@${domain}`, real_addresses: forwarding.split(',').map((item) => item.trim()).filter(Boolean), is_browsable: false } } } }); }
  update(binding: Binding, forwarding: string) { return this.request(`/api/v1/proxy-bindings/${binding.id}`, { method: 'PATCH', body: { data: { id: binding.id, type: 'proxy_bindings', attributes: { proxy_address: binding.address, real_addresses: Object.fromEntries(forwarding.split(',').map((item) => item.trim()).filter(Boolean).map((address) => [address, binding.states[address] ?? true])) } } } }); }
  setRecipient(binding: Binding, address: string, enabled: boolean) { return this.request(`/api/v1/proxy-bindings/${binding.id}`, { method: 'PATCH', body: { data: { id: binding.id, type: 'proxy_bindings', attributes: { proxy_address: binding.address, real_addresses: { [address]: enabled } } } } }); }
}
