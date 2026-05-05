<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

import type { ProxyBinding } from '../types/proxy-binding';

const proxyBindings = ref<ProxyBinding[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const refreshingId = ref<string | null>(null);

async function fetchProxyBindings(opts?: { background?: boolean; highlightId?: string }) {
  if (opts?.background) {
    refreshingId.value = opts.highlightId ?? null
  } else {
    loading.value = true;
  }
  error.value = null;
  try {
    const res = await fetch('/api/v1/proxy-bindings', {
      headers: {
        'Token': localStorage.getItem('api_token') ?? ''
      }
    });
    if (!res.ok) throw new Error('Failed to fetch proxy emails');
    const data = await res.json();
    proxyBindings.value = data.data.map((item: {
      id: string;
      attributes: {
        proxy_address: string;
        description?: string;
        is_browsable?: boolean;
        callback_url?: string;
        received_emails?: number;
        real_addresses?: Record<string, { is_enabled: boolean; is_verification_needed: boolean; is_verified: boolean }>;
      };
    }) => ({
      id: item.id,
      proxy_address: item.attributes.proxy_address,
      description: item.attributes.description,
      is_browsable: item.attributes.is_browsable,
      callback_url: item.attributes.callback_url,
      received_emails: item.attributes.received_emails,
      real_addresses: item.attributes.real_addresses,
    }));
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
    refreshingId.value = null;
  }
}

const allRealAddresses = computed(() => {
  const set = new Set<string>()
  for (const b of proxyBindings.value) {
    for (const addr of Object.keys(b.real_addresses ?? {})) {
      set.add(addr)
    }
  }
  return [...set].sort()
})

const allDomains = computed(() => {
  const set = new Set<string>()
  for (const b of proxyBindings.value) {
    const at = b.proxy_address.indexOf('@')
    if (at !== -1) set.add(b.proxy_address.slice(at + 1))
  }
  return [...set].sort()
})

const togglingId = ref<string | null>(null)
const copiedId = ref<string | null>(null)

async function copyAddress(binding: ProxyBinding) {
  await navigator.clipboard.writeText(binding.proxy_address)
  copiedId.value = binding.id
  setTimeout(() => { copiedId.value = null }, 1500)
}

function isEnabled(binding: ProxyBinding): boolean {
  const addrs = binding.real_addresses ?? {}
  return Object.values(addrs).some((a) => a.is_enabled)
}

async function toggleEnabled(binding: ProxyBinding) {
  togglingId.value = binding.id
  const nowEnabled = isEnabled(binding)
  const addrs = binding.real_addresses ?? {}
  const patched = Object.fromEntries(
    Object.keys(addrs).map((addr) => [addr, { is_enabled: !nowEnabled }])
  )
  try {
    const res = await fetch(`/api/v1/proxy-bindings/${binding.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Token: localStorage.getItem('api_token') ?? '',
      },
      body: JSON.stringify([{
        data: {
          type: 'proxy_bindings',
          attributes: { real_addresses: patched },
        },
      }]),
    })
    const text = await res.text()
    console.log('[toggle] PATCH', binding.id, res.status, text)
    if (!res.ok) throw new Error(`Failed to update (${res.status}): ${text}`)
    // Update local state immediately
    Object.keys(addrs).forEach((addr) => {
      const entry = binding.real_addresses?.[addr]
      if (entry) entry.is_enabled = !nowEnabled
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    togglingId.value = null
  }
}

onMounted(fetchProxyBindings);
defineExpose({ fetchProxyBindings, allRealAddresses, allDomains, refreshingId });
</script>

<template>
  <section>
    <div v-if="loading" class="status">Loading…</div>
    <div v-else-if="error" class="status error">{{ error }}</div>
    <ul v-else-if="proxyBindings.length" class="list">
      <li v-for="binding in proxyBindings" :key="binding.id" class="item">
        <div class="item-main">
          <span class="proxy-address">{{ binding.proxy_address }}</span>
          <span v-if="binding.description" class="description">{{ binding.description }}</span>
        </div>
        <div class="item-meta">
          <span v-if="binding.is_browsable" class="badge">Browsable</span>
          <span v-if="binding.received_emails" class="received">{{ binding.received_emails }} received</span>
        </div>
        <div class="item-actions">
          <button
            class="btn-icon btn-copy"
            :class="{ copied: copiedId === binding.id }"
            :title="copiedId === binding.id ? 'Copied!' : 'Copy address'"
            @click="copyAddress(binding)"
          >
            <svg v-if="copiedId !== binding.id" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
          <button
            class="btn-toggle"
            :class="{ enabled: isEnabled(binding) }"
            :disabled="togglingId === binding.id"
            :aria-label="isEnabled(binding) ? 'Disable' : 'Enable'"
            :title="isEnabled(binding) ? 'Disable' : 'Enable'"
            @click="toggleEnabled(binding)"
          >
            <span class="toggle-track">
              <span class="toggle-thumb" />
            </span>
          </button>
          <button class="btn-icon btn-edit"
            :disabled="refreshingId === binding.id"
            :style="refreshingId === binding.id ? 'opacity:0.35;cursor:not-allowed' : ''"
            title="Edit"
            @click="$emit('edit', binding)">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon btn-delete" title="Delete" @click="$emit('delete', binding)">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </li>
    </ul>
    <div v-else class="status">No proxy emails yet.</div>
  </section>
</template>

<style scoped>
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
</style>
