<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, onMounted, ref } from 'vue'
import { Check, Copy, SquarePen, Trash2 } from '@lucide/vue'

import type { ProxyBinding } from '../types/proxy-binding'
import { apiFetch } from '../utils/api'

const { t } = useI18n()

const proxyBindings = ref<ProxyBinding[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const refreshingId = ref<string | null>(null)

async function fetchProxyBindings(
  opts?: { background?: boolean; highlightId?: string },
) {
  if (opts?.background) {
    refreshingId.value = opts.highlightId ?? null
  }
  else {
    loading.value = true
  }
  error.value = null
  try {
    const res = await apiFetch('/api/v1/proxy-bindings', {
      headers: {
        Token: localStorage.getItem('api_token') ?? '',
      },
    })
    if (!res.ok) throw new Error(t('list.errorFetch'))
    const data = await res.json()
    proxyBindings.value = data.data.map(
      (item: {
        id: string
        attributes: {
          proxy_address: string
          description?: string
          is_browsable?: boolean
          callback_url?: string
          received_emails?: number
          real_addresses?: Record<
            string,
            {
              is_enabled: boolean
              is_verification_needed: boolean
              is_verified: boolean
            }
          >
        }
      }) => ({
        id: item.id,
        proxy_address: item.attributes.proxy_address,
        description: item.attributes.description,
        is_browsable: item.attributes.is_browsable,
        callback_url: item.attributes.callback_url,
        received_emails: item.attributes.received_emails,
        real_addresses: item.attributes.real_addresses,
      }),
    )
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
  finally {
    loading.value = false
    refreshingId.value = null
  }
}

const searchQuery = ref('')

function matchesSearch(b: ProxyBinding): boolean {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return true
  if (b.proxy_address.toLowerCase().includes(q)) return true
  if (b.description?.toLowerCase().includes(q)) return true
  if (Object.keys(b.real_addresses ?? {}).some(a => a.toLowerCase().includes(q))) return true
  return false
}

const enabledBindings = computed(() =>
  proxyBindings.value.filter(b => isEnabled(b) && matchesSearch(b))
)
const disabledBindings = computed(() =>
  proxyBindings.value.filter(b => !isEnabled(b) && matchesSearch(b))
)

const allRealAddresses = computed(() => {
  const set = new Set<string>()
  for (const b of proxyBindings.value) {
    for (const addr of Object.keys(b.real_addresses ?? {})) {
      set.add(addr)
    }
  }
  return [...set].sort()
})

const ALWAYS_AVAILABLE_DOMAINS = ['pdxmail.net', 'pdxmail.com', 'proxiedmail.com']
const customDomains = ref<string[]>([])

async function fetchCustomDomains() {
  try {
    const res = await apiFetch('/gapi/custom-domains?ignoreProcessing=1', {
      headers: { Token: localStorage.getItem('api_token') ?? '' },
    })
    if (!res.ok) return
    const data: Array<{ domain: string }> = await res.json()
    customDomains.value = data.map(d => d.domain)
  }
  catch {
    // silently ignore — always-available domains are still shown
  }
}

const allDomains = computed(() => {
  const set = new Set<string>([...ALWAYS_AVAILABLE_DOMAINS, ...customDomains.value])
  return [...set].sort()
})

const togglingId = ref<string | null>(null)
const copiedId = ref<string | null>(null)

async function copyAddress(binding: ProxyBinding) {
  await navigator.clipboard.writeText(binding.proxy_address)
  copiedId.value = binding.id
  setTimeout(() => {
    copiedId.value = null
  }, 1500)
}

function isEnabled(binding: ProxyBinding): boolean {
  const addrs = binding.real_addresses ?? {}
  return Object.values(addrs).some(a => a.is_enabled)
}

async function toggleEnabled(binding: ProxyBinding) {
  togglingId.value = binding.id
  const nowEnabled = isEnabled(binding)
  const addrs = binding.real_addresses ?? {}
  const patched = Object.fromEntries(
    Object.keys(addrs).map(addr => [addr, !nowEnabled]),
  )
  try {
    const res = await apiFetch(`/api/v1/proxy-bindings/${binding.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Token: localStorage.getItem('api_token') ?? '',
      },
      body: JSON.stringify({
        data: {
          id: binding.id,
          type: 'proxy_bindings',
          attributes: {
            real_addresses: patched,
            proxy_address: binding.proxy_address,
          },
        },
      }),
    })
    const text = await res.text()
    console.log('[toggle] PATCH', binding.id, res.status, text)
    if (!res.ok) throw new Error(t('list.errorToggle', { status: res.status, text }))
    // Update local state immediately
    Object.keys(addrs).forEach(addr => {
      const entry = binding.real_addresses?.[addr]
      if (entry) entry.is_enabled = !nowEnabled
    })
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
  finally {
    togglingId.value = null
  }
}

onMounted(() => {
  fetchProxyBindings()
  fetchCustomDomains()
})
defineExpose({ fetchProxyBindings, allRealAddresses, allDomains, refreshingId, proxyBindings })
</script>

<template>
  <section>
    <div class="search-bar">
      <input
        v-model="searchQuery"
        type="search"
        :placeholder="t('list.filterPlaceholder')"
        class="search-input"
      />
    </div>
    <div v-if="loading" class="status">{{ t('list.loading') }}</div>
    <div v-else-if="error" class="status error">{{ error }}</div>
    <div v-else-if="proxyBindings.length">
      <ul class="list">
        <li v-for="binding in enabledBindings" :key="binding.id" class="item">
          <div class="item-main">
            <span class="proxy-address">{{ binding.proxy_address }}</span>
            <span v-if="binding.description" class="description">{{
              binding.description
            }}</span>
          </div>
          <div class="item-meta">
            <span v-if="binding.is_browsable" class="badge">{{ t('list.browsable') }}</span>
            <span v-if="binding.received_emails" class="received">{{
                t('list.received', { count: binding.received_emails })
              }}</span>
          </div>
          <div class="item-actions">
            <button
              class="btn-icon btn-copy"
              :class="{ copied: copiedId === binding.id }"
              :title="copiedId === binding.id ? t('list.copied') : t('list.copyAddress')"
              @click="copyAddress(binding)"
            >
              <Copy v-if="copiedId !== binding.id" :size="16" />
              <Check v-else :size="16" />
            </button>
            <button
              class="btn-toggle"
              :class="{ enabled: isEnabled(binding) }"
              :disabled="togglingId === binding.id"
              :aria-label="isEnabled(binding) ? t('list.disable') : t('list.enable')"
              :title="isEnabled(binding) ? t('list.disable') : t('list.enable')"
              @click="toggleEnabled(binding)"
            >
              <span class="toggle-track">
                <span class="toggle-thumb" />
              </span>
            </button>
            <button
              class="btn-icon btn-edit"
              :disabled="refreshingId === binding.id"
              :style="refreshingId === binding.id ? 'opacity:0.35;cursor:not-allowed' : ''"
              :title="t('list.edit')"
              @click="$emit('edit', binding)"
            >
              <SquarePen :size="16" />
            </button>
            <button
              class="btn-icon btn-delete"
              :title="t('list.delete')"
              @click="$emit('delete', binding)"
            >
              <Trash2 :size="16" />
            </button>
          </div>
        </li>
      </ul>

      <details v-if="disabledBindings.length" class="disabled-section" :open="!!searchQuery.trim()">
        <summary class="disabled-summary">
          {{ t('list.disabled', { count: disabledBindings.length }) }}
        </summary>
        <ul class="list disabled-list">
          <li
            v-for="binding in disabledBindings"
            :key="binding.id"
            class="item item-disabled"
          >
            <div class="item-main">
              <span class="proxy-address">{{ binding.proxy_address }}</span>
              <span v-if="binding.description" class="description">{{
                binding.description
              }}</span>
            </div>
            <div class="item-meta">
              <span v-if="binding.is_browsable" class="badge">{{ t('list.browsable') }}</span>
              <span v-if="binding.received_emails" class="received">{{
                  t('list.received', { count: binding.received_emails })
                }}</span>
            </div>
            <div class="item-actions">
              <button
                class="btn-icon btn-copy"
                :class="{ copied: copiedId === binding.id }"
                :title="copiedId === binding.id ? t('list.copied') : t('list.copyAddress')"
                @click="copyAddress(binding)"
              >
                <Copy v-if="copiedId !== binding.id" :size="16" />
                <Check v-else :size="16" />
              </button>
              <button
                class="btn-toggle"
                :class="{ enabled: isEnabled(binding) }"
                :disabled="togglingId === binding.id"
                :aria-label="isEnabled(binding) ? t('list.disable') : t('list.enable')"
                :title="isEnabled(binding) ? t('list.disable') : t('list.enable')"
                @click="toggleEnabled(binding)"
              >
                <span class="toggle-track">
                  <span class="toggle-thumb" />
                </span>
              </button>
              <button
                class="btn-icon btn-edit"
                :disabled="refreshingId === binding.id"
                :style="refreshingId === binding.id ? 'opacity:0.35;cursor:not-allowed' : ''"
                :title="t('list.edit')"
                @click="$emit('edit', binding)"
              >
                <SquarePen :size="16" />
              </button>
              <button
                class="btn-icon btn-delete"
                :title="t('list.delete')"
                @click="$emit('delete', binding)"
              >
                <Trash2 :size="16" />
              </button>
            </div>
          </li>
        </ul>
      </details>
    </div>
    <div v-else-if="searchQuery.trim()" class="status">{{ t('list.noResults', { query: searchQuery.trim() }) }}</div>
    <div v-else class="status">{{ t('list.empty') }}</div>
  </section>
</template>

<style scoped>
.search-bar {
  margin-bottom: 0.75rem;
}

.search-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-background-soft);
  color: var(--color-text);
  font-size: 0.9rem;
  box-sizing: border-box;
  outline: none;
}

.search-input:focus {
  border-color: #4f46e5;
}

.status {
  padding: 2rem;
  text-align: center;
  color: var(--color-text);
  opacity: 0.6;
}

.status.error {
  color: #dc2626;
  opacity: 1;
}

.list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 1rem;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 6px;
}

.item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.proxy-address {
  font-family: monospace;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-heading);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.description {
  font-size: 0.8rem;
  color: var(--color-text);
  opacity: 0.7;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-shrink: 0;
}

.badge {
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: #e0e7ff;
  color: #4338ca;
}

@media (prefers-color-scheme: dark) {
  .badge {
    background: #312e81;
    color: #c7d2fe;
  }
}

.received {
  font-size: 0.8rem;
  color: var(--color-text);
  opacity: 0.6;
}

.item-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

button {
  padding: 0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: none;
  color: var(--color-text);
}

.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 4px;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}

.btn-icon svg {
  width: 1rem;
  height: 1rem;
  display: block;
}

.btn-copy {
  color: var(--color-text);
  opacity: 0.5;
  transition: opacity 0.15s, color 0.15s;
}

.btn-copy:hover {
  opacity: 1;
}

.btn-copy.copied {
  color: #059669;
  opacity: 1;
}

@media (prefers-color-scheme: dark) {
  .btn-copy.copied {
    color: #6ee7b7;
  }
}

.btn-edit {
  color: var(--color-text);
  opacity: 0.5;
}

.btn-edit:hover {
  opacity: 1;
  background: var(--color-border);
}

.btn-delete {
  color: #b91c1c;
  opacity: 0.6;
}

.btn-delete:hover {
  opacity: 1;
  background: #fee2e2;
}

@media (prefers-color-scheme: dark) {
  .btn-delete {
    color: #fca5a5;
  }
  .btn-delete:hover {
    background: #450a0a;
  }
}

.btn-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: none;
  border: none;
  padding: 0.2rem;
  cursor: pointer;
  color: var(--color-text);
  opacity: 0.6;
}

.btn-toggle:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.btn-toggle.enabled {
  opacity: 1;
}

.toggle-track {
  position: relative;
  display: inline-block;
  width: 2rem;
  height: 1.1rem;
  background: var(--color-border, #ccc);
  border-radius: 999px;
  transition: background 0.2s;
  flex-shrink: 0;
}

.btn-toggle.enabled .toggle-track {
  background: #4f46e5;
}

.toggle-thumb {
  position: absolute;
  top: 0.15rem;
  left: 0.15rem;
  width: 0.8rem;
  height: 0.8rem;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}

.btn-toggle.enabled .toggle-thumb {
  transform: translateX(0.9rem);
}

.disabled-section {
  margin-top: 1rem;
}

.disabled-summary {
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--color-text);
  opacity: 0.55;
  padding: 0.35rem 0.25rem;
  user-select: none;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.disabled-summary::-webkit-details-marker {
  display: none;
}

.disabled-summary::before {
  content: "▶";
  font-size: 0.65rem;
  transition: transform 0.15s;
  display: inline-block;
}

details[open] > .disabled-summary::before {
  transform: rotate(90deg);
}

.disabled-summary:hover {
  opacity: 0.9;
}

.disabled-list {
  margin-top: 0.5rem;
}

.item-disabled {
  opacity: 0.5;
}
</style>
