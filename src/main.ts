import './styles.css';
import '@awesome.me/webawesome/dist/components/button/button.js';
import '@awesome.me/webawesome/dist/components/callout/callout.js';
import '@awesome.me/webawesome/dist/components/dialog/dialog.js';
import '@awesome.me/webawesome/dist/components/dropdown/dropdown.js';
import '@awesome.me/webawesome/dist/components/input/input.js';
import '@awesome.me/webawesome/dist/components/option/option.js';
import '@awesome.me/webawesome/dist/components/select/select.js';
import '@awesome.me/webawesome/dist/components/switch/switch.js';
import '@awesome.me/webawesome/dist/styles/themes/default.css';
import { authenticate, createBinding, createUser, deleteBinding, fetchApiToken, getAvailableDomains, getBindings, getCurrentUser, getReceivedEmailLinks, getSettings, getUsedOnEntries, replaceRealEmail, setBindingPassword, updateBinding, updateSettings, updateUsedOnEntries, type ProxyBinding, ApiError } from './api';
import renderView from '../gen/generated-templates';
import { icons } from 'lucide';
import { getLocale, setLocale, t, type Locale } from './i18n';

const app = document.querySelector<HTMLDivElement>('#app')!;
const demoBindings: ProxyBinding[] = [
  { id: 'demo-1', proxy_address: 'news@pdxmail.net', real_addresses: { 'hello@example.com': { is_enabled: true, is_verified: true } }, is_browsable: true, received_emails: 12, description: 'Newsletters and reading lists', created_at: '2026-08-14' },
  { id: 'demo-2', proxy_address: 'orders@proxiedmail.com', real_addresses: { 'hello@example.com': { is_enabled: true, is_verified: true } }, is_browsable: false, received_emails: 0, description: 'Shopping receipts', created_at: '2026-09-02' },
  { id: 'demo-3', proxy_address: 'trials@pdxmail.com', real_addresses: { 'hello@example.com': { is_enabled: true, is_verified: true } }, is_browsable: true, received_emails: 4, description: 'Product trials', created_at: '2026-09-18' },
];
const demoDomains = [{ domain: 'pdxmail.net' }, { domain: 'proxiedmail.com', isPremium: true }];

let bindings: ProxyBinding[] = [];
let availableBindings = 0;
let isDemo = false;
let notice = '';
let twoFactorEnabled = false;
let searchTimer: number | undefined;
const hideIamRichCookie = 'proxiedmail-hide-iam-rich';

function cookieFlag(name: string): boolean { return document.cookie.split('; ').some((entry) => entry === `${name}=1`); }
function setCookieFlag(name: string, enabled: boolean): void { document.cookie = `${name}=${enabled ? '1' : '0'}; Path=/; Max-Age=31536000; SameSite=Lax`; }
function visibleDomains(domains: string[]): string[] { return domains.filter((domain) => !(cookieFlag(hideIamRichCookie) && domain === 'iam-rich.net')); }

function icon(name: keyof typeof icons, size = 18) {
  const content = icons[name].map(([tag, attributes]) => {
    const attrs = Object.entries(attributes).map(([key, value]) => `${key}="${String(value)}"`).join(' ');
    return `<${tag} ${attrs}></${tag}>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`;
}

function renderAuth() {
  app.innerHTML = renderView({ view: 'auth', icon, t });
  document.querySelector<HTMLFormElement>('#auth-form')!.addEventListener('submit', handleLogin);
  document.querySelector('#account-button')!.addEventListener('click', renderRegistration);
}

async function renderRegistration() {
  const root = document.querySelector('#auth-modal-root')!;
  root.innerHTML = renderView({ view: 'register', icon, t });
  const dialog = document.querySelector<HTMLElement>('#register-dialog') as HTMLElement & { show: () => void };
  await customElements.whenDefined('wa-dialog'); await new Promise(requestAnimationFrame); openDialog(dialog);
  const username = document.querySelector<HTMLElement & { value: string }>('#register-username')!;
  const password = document.querySelector<HTMLElement & { value: string }>('#register-password')!;
  const confirm = document.querySelector<HTMLElement & { value: string }>('#register-password-confirm')!;
  const submit = document.querySelector<HTMLElement & { disabled: boolean }>('#register-submit')!;
  const validate = () => { submit.disabled = !username.value || !password.value || !confirm.value || password.value !== confirm.value; };
  for (const field of [username, password, confirm]) { field.addEventListener('input', validate); field.addEventListener('wa-input', validate); }
  validate();
  document.querySelector<HTMLFormElement>('#register-form')!.addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = document.querySelector('#register-error')!;
    validate();
    if (submit.disabled) return;
    try { await createUser(username.value, password.value); closeModal(); notice = t('notice.accountCreated'); renderAuth(); }
    catch (reason) { error.textContent = reason instanceof Error ? reason.message : t('error.createAccount'); error.removeAttribute('hidden'); }
  });
}

async function handleLogin(event: SubmitEvent) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const button = form.querySelector<HTMLElement & { disabled: boolean }>('wa-button[type="submit"]')!;
  const error = document.querySelector<HTMLDivElement>('#auth-error')!;
  button.disabled = true; button.textContent = t('status.opening'); error.classList.add('hidden');
  try {
    const oauth = await authenticate((document.querySelector('#username') as HTMLInputElement | HTMLElement & { value: string }).value, (document.querySelector('#password') as HTMLInputElement | HTMLElement & { value: string }).value);
    localStorage.setItem('proxiedmail-oauth-token', oauth);
    localStorage.setItem('proxiedmail-token', await fetchApiToken(oauth));
    const profile = await getCurrentUser();
    twoFactorEnabled = profile.twoFactorEnabled;
    const result = await getBindings();
    bindings = result.bindings; availableBindings = result.quota.available; renderDashboard();
  } catch (reason) {
    error.textContent = reason instanceof ApiError || reason instanceof Error ? reason.message : t('error.signIn');
    error.classList.remove('hidden'); button.disabled = false; button.innerHTML = `${icon('ArrowUpRight', 18)} ${t('auth.open')}`;
  }
}

function enabledRecipients(binding: ProxyBinding) { return Object.entries(binding.real_addresses || {}).filter(([, value]) => value.is_enabled).map(([address]) => address); }

function renderDashboard(filter = '') {
  const visibleBindings = bindings.filter((binding) => `${binding.proxy_address} ${binding.description || ''}`.toLowerCase().includes(filter.toLowerCase()));
  const totalReceived = bindings.reduce((sum, binding) => sum + (binding.received_emails || 0), 0);
  const bindingCapacity = bindings.length + availableBindings;
  app.innerHTML = renderView({ view: 'dashboard', icon, t, twoFactorEnabled, searchValue: filter, bindings: visibleBindings, allBindings: bindings, bindingCapacity, totalReceived, notice });
  document.querySelector('#logout-button')!.addEventListener('click', () => { localStorage.removeItem('proxiedmail-token'); localStorage.removeItem('proxiedmail-oauth-token'); isDemo = false; renderAuth(); });
  document.querySelector('#create-button')!.addEventListener('click', renderCreateModal);
  document.querySelector('#settings-button')!.addEventListener('click', renderSettings);
  const filterRows = (event: Event) => {
    const source = event.currentTarget as HTMLElement & { value?: string };
    const detail = (event as CustomEvent<{ value?: string }>).detail;
    const query = String(source?.value ?? detail?.value ?? '').toLowerCase().trim();
    applySearch(query);
  };
  const applySearch = (query: string) => document.querySelectorAll<HTMLElement>('[data-search-text]').forEach((row) => {
    const matches = row.dataset.searchText!.includes(query);
    row.hidden = !matches;
    row.style.display = matches ? '' : 'none';
  });
  const search = document.querySelector<HTMLElement & { value?: string }>('#search')!;
  search.addEventListener('input', filterRows);
  search.addEventListener('change', filterRows);
  search.addEventListener('wa-input', filterRows);
  search.addEventListener('wa-change', filterRows);
  customElements.whenDefined('wa-input').then(async () => {
    const component = search as HTMLElement & { updateComplete?: Promise<unknown> };
    await component.updateComplete;
    const innerInput = search.shadowRoot?.querySelector('input');
    if (innerInput) innerInput.addEventListener('input', filterRows);
  });
  if (searchTimer) window.clearInterval(searchTimer);
  let observedValue = search.value || filter;
  searchTimer = window.setInterval(() => {
    const value = search.shadowRoot?.querySelector<HTMLInputElement>('input')?.value || search.value || '';
    if (value !== observedValue) { observedValue = value; applySearch(value.toLowerCase().trim()); }
  }, 100);
  document.querySelector('#binding-list')!.addEventListener('click', (event) => {
    const trigger = (event.target as HTMLElement).closest<HTMLElement>('[data-open-binding]');
    if (trigger) renderBindingDetail(trigger.dataset.openBinding!);
  });
  if (notice) setTimeout(() => { notice = ''; }, 4000);
  registerServiceWorker();
}

async function renderCreateModal() {
  document.querySelector('#modal-root')!.innerHTML = renderView({ view: 'create', icon, t });
  const dialog = document.querySelector<HTMLElement>('#create-dialog') as HTMLElement & { show: () => void };
  await customElements.whenDefined('wa-dialog');
  await new Promise(requestAnimationFrame);
  openDialog(dialog);
  document.querySelector('#cancel-create')!.addEventListener('click', closeModal);
  document.querySelector<HTMLFormElement>('#create-form')!.addEventListener('submit', handleCreate);
  document.querySelector('#generate-address')!.addEventListener('click', () => {
    const input = document.querySelector<HTMLElement & { value: string }>('#proxy-address')!;
    input.value = randomLocalPart();
  });
  loadAvailableDomains();
}

function randomLocalPart(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('');
}

async function renderSettings() {
  const entries = await getSettings().catch(() => []);
  const banner = entries.find((entry) => /mail.?info|banner/i.test(entry.key));
  const retention = entries.find((entry) => /retention|received.?messages?/i.test(entry.key));
  const availableDomains = visibleDomains((await getAvailableDomains().catch(() => [])).map((entry) => entry.domain).filter(Boolean));
  const targetEmails = [...new Set(bindings.flatMap((binding) => enabledRecipients(binding)))].sort();
  document.querySelector('#modal-root')!.innerHTML = renderView({ view: 'settings', icon, t, token: localStorage.getItem('proxiedmail-token') || '', hideIamRich: cookieFlag(hideIamRichCookie), mailInfoEnabled: banner ? banner.value === '1' || banner.value === 'true' : false, messageRetention: retention?.value || '1-day', targetEmails, availableDomains, bitwardenDomain: availableDomains[0] || '' });
  const dialog = document.querySelector<HTMLElement>('#settings-dialog') as HTMLElement & { show: () => void };
  await customElements.whenDefined('wa-dialog'); await new Promise(requestAnimationFrame); openDialog(dialog);
  const localeSelect = document.querySelector<HTMLElement & { value: string }>('#locale-select');
  if (localeSelect) { localeSelect.value = getLocale(); localeSelect.addEventListener('wa-change', () => { setLocale(localeSelect.value as Locale); closeModal(); renderDashboard(); }); }
    document.querySelector('#bitwarden-button')!.addEventListener('click', async () => {
      const dialog = document.querySelector<HTMLElement>('#bitwarden-dialog') as HTMLElement & { show: () => void };
      await customElements.whenDefined('wa-dialog'); await new Promise(requestAnimationFrame); openDialog(dialog);
    });
  document.querySelector('#save-settings')!.addEventListener('click', async () => {
    const hideIamRich = document.querySelector<HTMLElement & { checked: boolean }>('#hide-iam-rich')!;
    const toggle = document.querySelector<HTMLElement & { checked: boolean }>('#mail-info-banner')!;
    const messageRetention = document.querySelector<HTMLElement & { value: string }>('#message-retention')!;
    const error = document.querySelector('#settings-error')!;
    try { setCookieFlag(hideIamRichCookie, hideIamRich.checked); await updateSettings([{ key: banner?.key || 'show_mail_info_banner', value: toggle.checked ? '1' : '0' }, { key: retention?.key || 'received_messages_retention', value: messageRetention.value }]); closeModal(); notice = t('notice.updated', { address: t('account.settings') }); renderDashboard(); }
    catch (reason) { error.textContent = reason instanceof Error ? reason.message : t('error.save'); error.removeAttribute('hidden'); }
  });
  document.querySelector('#replace-email')!.addEventListener('click', async () => {
    const oldEmail = document.querySelector<HTMLElement & { value: string }>('#old-email')!;
    const newEmail = document.querySelector<HTMLElement & { value: string }>('#new-email')!;
    const error = document.querySelector('#settings-error')!;
    try { await replaceRealEmail(oldEmail.value, newEmail.value); closeModal(); notice = t('notice.updated', { address: t('account.replaceTarget') }); renderDashboard(); }
    catch (reason) { error.textContent = reason instanceof Error ? reason.message : t('error.save'); error.removeAttribute('hidden'); }
  });
}

async function loadAvailableDomains() {
  const select = document.querySelector<HTMLSelectElement>('#domain-select');
  if (!select) return;
  if (isDemo) {
    select.innerHTML = demoDomains.map((entry) => `<wa-option value="${entry.domain}">@${entry.domain}${entry.isPremium ? ' · Premium' : ''}</wa-option>`).join('');
    select.value = demoDomains[0].domain;
    return;
  }
  try {
    const domains = (await getAvailableDomains()).filter((entry) => visibleDomains([entry.domain]).length > 0);
    if (!domains.length) throw new Error(t('error.noDomains'));
    select.innerHTML = domains.map((entry) => `<wa-option value="${entry.domain}">${entry.display_name || `@${entry.domain}`}${entry.isPremium ? ' · Premium' : ''}</wa-option>`).join('');
    select.value = domains[0].domain;
  } catch (reason) {
    select.innerHTML = `<wa-option value="">${reason instanceof Error ? reason.message : t('error.domainsUnavailable')}</wa-option>`;
    select.disabled = true;
    const createButton = document.querySelector<HTMLElement>('#create-form wa-button[variant="brand"]') as HTMLElement & { disabled: boolean } | null;
    if (createButton) createButton.disabled = true;
  }
}

async function handleCreate(event: SubmitEvent) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const button = form.querySelector<HTMLElement & { disabled: boolean }>('wa-button[type="submit"]')!;
  const error = document.querySelector('#create-error')!;
  button.disabled = true; button.textContent = t('status.creating');
  const name = (document.querySelector('#proxy-address') as HTMLElement & { value: string }).value;
  const domain = (document.querySelector('#domain-select') as HTMLElement & { value: string }).value;
  const address = `${name}@${domain}`;
  const recipient = (document.querySelector('#real-address') as HTMLElement & { value: string }).value;
  const browsable = false;
  try {
    const binding = isDemo ? { id: `demo-${Date.now()}`, proxy_address: address, real_addresses: { [recipient]: { is_enabled: true, is_verified: true } }, is_browsable: browsable, received_emails: 0, description: '' } : await createBinding(address, recipient, browsable);
    bindings = [binding, ...bindings]; if (isDemo) availableBindings = Math.max(availableBindings - 1, 0);
    notice = t('notice.ready', { address }); closeModal(); renderDashboard();
  } catch (reason) {
    error.textContent = reason instanceof Error ? reason.message : t('error.create');
    error.classList.remove('hidden'); button.disabled = false; button.innerHTML = `${icon('ArrowRight', 17)} ${t('create.submit')}`;
  }
}

async function renderBindingDetail(bindingId: string) {
  const binding = bindings.find((entry) => entry.id === bindingId);
  if (!binding) return;
  const recipients = enabledRecipients(binding);
  document.querySelector('#modal-root')!.innerHTML = renderView({ view: 'detail', icon, t, twoFactorEnabled, binding, recipients });
  const dialog = document.querySelector<HTMLElement>('#detail-dialog') as HTMLElement & { show: () => void };
  await customElements.whenDefined('wa-dialog');
  await new Promise(requestAnimationFrame);
  openDialog(dialog);
  document.querySelector('#copy-address')!.addEventListener('click', async () => { await navigator.clipboard?.writeText(binding.proxy_address); notice = t('notice.copied'); });
  const editForm = document.querySelector<HTMLFormElement>('#edit-binding')!;
  const saveButton = editForm.querySelector<HTMLElement>('[type="submit"]')!;
  editForm.addEventListener('submit', (event) => handleBindingUpdate(event, binding));
  document.querySelector('#delete-binding')!.addEventListener('click', () => handleBindingDelete(binding));
  document.querySelector('#received-button')!.addEventListener('click', () => loadReceivedMessages(binding));
  loadUsedOn(binding.id);
}

async function loadUsedOn(bindingId: string) {
  const input = document.querySelector<HTMLElement & { value: string }>('#binding-used-on'); if (!input) return;
  if (isDemo) { input.value = 'news.example, reading.example'; return; }
  try { input.value = (await getUsedOnEntries(bindingId)).join(', '); } catch { input.value = ''; }
}

async function handleBindingUpdate(event: Event, binding: ProxyBinding) {
  event.preventDefault();
  const form = document.querySelector<HTMLFormElement>('#edit-binding');
  if (!form) return;
  const button = form.querySelector<HTMLElement & { disabled: boolean }>('wa-button[type="submit"]')!; const error = document.querySelector('#detail-error')!;
  if (button.disabled) return;
  button.disabled = true; button.textContent = t('status.saving'); error.classList.add('hidden');
  const recipient = (document.querySelector('#binding-recipient') as HTMLElement & { value: string }).value;
  const real_addresses = Object.fromEntries(Object.keys(binding.real_addresses || {}).map((address) => [address, { is_enabled: address === recipient }])) as Record<string, { is_enabled: boolean }>;
  real_addresses[recipient] = { is_enabled: true };
  const changes = { description: (document.querySelector('#binding-description') as HTMLElement & { value: string }).value, callback_url: (document.querySelector('#binding-callback') as HTMLElement & { value: string }).value, real_addresses };
  const password = (document.querySelector('#binding-password') as HTMLElement & { value: string }).value;
  const sites = (document.querySelector('#binding-used-on') as HTMLElement & { value: string }).value.split(',').map((site) => site.trim()).filter(Boolean);
  try {
    const updated = isDemo ? { ...binding, ...changes } : await updateBinding(binding, changes);
    if (!isDemo) { if (password) await setBindingPassword(binding.id, password); await updateUsedOnEntries(binding.id, sites); }
    bindings = bindings.map((entry) => entry.id === binding.id ? updated : entry); closeModal(); notice = t('notice.updated', { address: binding.proxy_address }); renderDashboard();
  } catch (reason) { error.textContent = reason instanceof Error ? reason.message : t('error.save'); error.classList.remove('hidden'); button.disabled = false; button.innerHTML = `${icon('Check', 17)} ${t('detail.save')}`; }
}

async function handleBindingDelete(binding: ProxyBinding) {
  if (!window.confirm(t('confirm.delete', { address: binding.proxy_address }))) return;
  try { if (!isDemo) await deleteBinding(binding.id); bindings = bindings.filter((entry) => entry.id !== binding.id); closeModal(); notice = t('notice.deleted', { address: binding.proxy_address }); renderDashboard(); }
  catch (reason) { const error = document.querySelector('#detail-error')!; error.textContent = reason instanceof Error ? reason.message : t('error.delete'); error.classList.remove('hidden'); }
}

async function loadReceivedMessages(binding: ProxyBinding) {
  const list = document.querySelector('#received-list')!; list.classList.remove('hidden'); list.innerHTML = `<p class="muted">${t('detail.loadingMessages')}</p>`;
  if (!binding.is_browsable) { list.innerHTML = `<p class="muted">${t('detail.enableMessages')}</p>`; return; }
  try { const messages = isDemo ? [{ id: 'demo-message', subject: 'Your weekly reading list', sender: 'digest@example.com', created_at: 'Today' }] : await getReceivedEmailLinks(binding.id); list.innerHTML = messages.length ? `<p class="advanced-label">${t('detail.latestMessages')}</p>${messages.map((message) => `<div class="message-item"><strong>${message.subject || t('detail.receivedMessage')}</strong><small>${message.sender || t('detail.unknownSender')} · ${message.created_at || t('detail.recently')}</small></div>`).join('')}` : `<p class="muted">${t('detail.noMessages')}</p>`; }
  catch (reason) { list.innerHTML = `<p class="error-message">${reason instanceof Error ? reason.message : t('error.messages')}</p>`; }
}

function openDialog(dialog: HTMLElement & { show?: () => void }) {
  try { dialog.show?.(); } catch { dialog.setAttribute('open', ''); }
}

function closeModal() { const root = document.querySelector<HTMLElement>('#modal-root, #auth-modal-root'); const dialog = root?.querySelector('wa-dialog') as (HTMLElement & { hide?: () => void }) | null; try { dialog?.hide?.(); } catch { dialog?.removeAttribute('open'); } setTimeout(() => { if (root) root.innerHTML = ''; }, 150); }
function registerServiceWorker() { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined); }

if (localStorage.getItem('proxiedmail-token')) { Promise.all([getCurrentUser(), getBindings()]).then(([profile, result]) => { twoFactorEnabled = profile.twoFactorEnabled; bindings = result.bindings; availableBindings = result.quota.available; renderDashboard(); }).catch(() => { localStorage.removeItem('proxiedmail-token'); renderAuth(); }); } else renderAuth();