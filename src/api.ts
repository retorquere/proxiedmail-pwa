export type ProxyBinding = {
  id: string;
  proxy_address: string;
  real_addresses: Record<string, { is_enabled?: boolean; is_verified?: boolean; is_verification_needed?: boolean }>;
  is_browsable: boolean;
  received_emails: number;
  description?: string;
  callback_url?: string;
  wildcard_auto_create?: boolean;
  created_at?: string;
};

import { t } from './i18n';

type ApiDocument<T> = { data?: { id?: string; attributes?: T } | Array<{ id?: string; attributes?: T }>; meta?: Record<string, unknown> };

const apiBase = '';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('proxiedmail-token');
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Token', token);

  const response = await fetch(`${apiBase}${path}`, { ...init, headers });
  const body = await response.text();
  let parsed: unknown = null;
  try { parsed = body ? JSON.parse(body) : null; } catch { parsed = null; }
  if (!response.ok) {
    const message = typeof parsed === 'object' && parsed && 'message' in parsed && typeof parsed.message === 'string'
      ? parsed.message
      : response.status === 401 ? t('error.sessionExpired') : t('error.requestFailed', { status: response.status });
    throw new ApiError(response.status, message);
  }
  return parsed as T;
}

async function requestWithBearer<T>(path: string, init: RequestInit = {}): Promise<T> {
  const oauthToken = localStorage.getItem('proxiedmail-oauth-token');
  const apiToken = localStorage.getItem('proxiedmail-token');
  if (!oauthToken && !apiToken) throw new ApiError(401, t('error.sessionExpiredSignIn'));
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('Content-Type', 'application/json');
  if (oauthToken) headers.set('Authorization', `Bearer ${oauthToken}`);
  if (apiToken) headers.set('Token', apiToken);
  const response = await fetch(path, { ...init, headers });
  const body = await response.text();
  let parsed: unknown = null;
  try { parsed = body ? JSON.parse(body) : null; } catch { parsed = null; }
  if (!response.ok) {
    const message = typeof parsed === 'object' && parsed && 'message' in parsed && typeof parsed.message === 'string'
      ? parsed.message
      : response.status === 401 ? t('error.sessionExpiredSignIn') : t('error.requestFailed', { status: response.status });
    throw new ApiError(response.status, message);
  }
  return parsed as T;
}

export async function authenticate(username: string, password: string): Promise<string> {
  const body = { data: { type: 'auth-request', attributes: { username, password } } };
  const response = await request<ApiDocument<{ token?: string }>>('/api/v1/auth', { method: 'POST', body: JSON.stringify(body) });
  const token = response.data && !Array.isArray(response.data) ? response.data.attributes?.token : undefined;
  if (!token) throw new Error(t('error.noSessionToken'));
  return token;
}

export async function createUser(username: string, password: string): Promise<void> {
  await request<unknown>('/api/v1/users', { method: 'POST', body: JSON.stringify({ data: { type: 'users', attributes: { username, password, keyLandingPage: 'dashboard' } } }) });
}

export async function fetchApiToken(oauthToken: string): Promise<string> {
  const response = await fetch('/api/v1/api-token', { headers: { Accept: 'application/json', Authorization: `Bearer ${oauthToken}` } });
  const parsed = await response.json() as { token?: string } & ApiDocument<{ token?: string }>;
  const token = parsed.token || (!Array.isArray(parsed.data) ? parsed.data?.attributes?.token : undefined);
  if (!response.ok || !token) throw new ApiError(response.status, t('error.apiToken'));
  return token;
}

export async function getBindings(): Promise<{ bindings: ProxyBinding[]; quota: { used: number; available: number } }> {
  const response = await request<ApiDocument<ProxyBinding> & { meta?: { usedProxyBindings?: number; availableProxyBindings?: number } }>('/api/v1/proxy-bindings?sort=desc');
  const bindings = Array.isArray(response.data) ? response.data.map((entry) => ({ id: entry.id || crypto.randomUUID(), ...(entry.attributes || {}) } as ProxyBinding)) : [];
  return { bindings, quota: { used: response.meta?.usedProxyBindings ?? bindings.length, available: response.meta?.availableProxyBindings ?? 0 } };
}

export async function getCurrentUser(): Promise<{ twoFactorEnabled: boolean }> {
  const response = await request<{ data?: { attributes?: { ['2fa_enabled']?: boolean } } }>('/api/v1/users/me');
  return { twoFactorEnabled: response.data?.attributes?.['2fa_enabled'] === true };
}

export async function getSettings(): Promise<Array<{ key: string; value: string }>> {
  const response = await requestWithBearer<unknown>('/gapi/settings');
  const entries = typeof response === 'object' && response && 'settings' in response && Array.isArray(response.settings) ? response.settings : Array.isArray(response) ? response : [];
  return entries as Array<{ key: string; value: string }>;
}

export async function updateSettings(settings: Array<{ key: string; value: string }>): Promise<void> {
  await requestWithBearer<unknown>('/gapi/settings/update', { method: 'PATCH', body: JSON.stringify({ settings }) });
}

export async function replaceRealEmail(oldEmail: string, newEmail: string): Promise<void> {
  await request<unknown>('/api/v1/emails/replace', { method: 'POST', body: JSON.stringify({ data: { type: 'replace-real-emails', attributes: { oldEmail, newEmail } } }) });
}

export async function createBinding(proxyAddress: string, realAddress: string, browsable: boolean): Promise<ProxyBinding> {
  const body = { data: { type: 'proxy_bindings', attributes: { proxy_address: proxyAddress, real_addresses: [realAddress], is_browsable: browsable } } };
  const response = await request<ApiDocument<ProxyBinding>>('/api/v1/proxy-bindings', { method: 'POST', body: JSON.stringify(body) });
  if (!response.data || Array.isArray(response.data)) throw new Error('The API returned an invalid binding.');
  return { id: response.data.id || crypto.randomUUID(), ...(response.data.attributes || {}) } as ProxyBinding;
}

export async function updateBinding(binding: ProxyBinding, changes: Partial<Pick<ProxyBinding, 'description' | 'callback_url' | 'wildcard_auto_create'>> & { received_emails?: number; real_addresses?: Record<string, { is_enabled: boolean }> }): Promise<ProxyBinding> {
  const body = { data: { id: binding.id, type: 'proxy_bindings', attributes: { proxy_address: binding.proxy_address, ...changes } } };
  const response = await request<ApiDocument<ProxyBinding>>(`/api/v1/proxy-bindings/${binding.id}`, { method: 'PATCH', body: JSON.stringify(body) });
  if (!response.data || Array.isArray(response.data)) throw new Error('The API returned an invalid binding.');
  return { ...binding, id: response.data.id || binding.id, ...(response.data.attributes || {}) } as ProxyBinding;
}

export async function deleteBinding(bindingId: string): Promise<void> {
  await request<unknown>(`/api/v1/proxy-bindings/${bindingId}`, { method: 'DELETE' });
}

export async function setBindingPassword(bindingId: string, password: string): Promise<void> {
  const oauthToken = localStorage.getItem('proxiedmail-oauth-token');
  const headers = new Headers({ Accept: 'application/json', 'Content-Type': 'application/json' });
  if (oauthToken) headers.set('Authorization', `Bearer ${oauthToken}`);
  else {
    const apiToken = localStorage.getItem('proxiedmail-token');
    if (apiToken) headers.set('Token', apiToken);
  }
  const response = await fetch('/gapi/passwords/proxy-binding', {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ proxy_binding_id: bindingId, password }),
  });
  if (!response.ok) throw new ApiError(response.status, response.status === 403 ? t('error.passwordPermission') : t('error.password'));
}

export async function getUsedOnEntries(bindingId: string): Promise<string[]> {
  const response = await requestWithBearer<unknown>('/gapi/used-on');
  const entries = Array.isArray(response) ? response : [];
  const entry = entries.find((candidate) => typeof candidate === 'object' && candidate && 'proxy_binding_id' in candidate && candidate.proxy_binding_id === bindingId) as { list?: unknown } | undefined;
  return Array.isArray(entry?.list) ? entry.list.filter((site): site is string => typeof site === 'string') : [];
}

export async function updateUsedOnEntries(bindingId: string, sites: string[]): Promise<void> {
  await requestWithBearer<unknown>('/gapi/used-on', { method: 'PATCH', body: JSON.stringify({ proxy_binding_id: bindingId, list: sites }) });
}

export async function getAvailableDomains(): Promise<Array<{ domain: string; display_name?: string; isPremium?: boolean }>> {
  const response = await requestWithBearer<unknown>('/gapi/available-domains');
  if (!Array.isArray(response)) return [];
  return response.map((entry) => typeof entry === 'string' ? { domain: entry } : entry).filter((entry): entry is { domain: string; display_name?: string; isPremium?: boolean } => Boolean(entry && typeof entry === 'object' && 'domain' in entry && typeof entry.domain === 'string'));
}

export async function getReceivedEmailLinks(bindingId: string): Promise<Array<{ id: string; subject?: string; sender?: string; created_at?: string }>> {
  const response = await request<unknown>(`/api/v1/received-emails-links/${bindingId}`);
  const entries = Array.isArray(response) ? response : typeof response === 'object' && response && 'data' in response && Array.isArray(response.data) ? response.data : [];
  return entries as Array<{ id: string; subject?: string; sender?: string; created_at?: string }>;
}