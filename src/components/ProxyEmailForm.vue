<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { generateSlug } from 'random-word-slugs'
import type { ProxyBinding, RealAddress } from '../types/proxy-binding'

const props = defineProps<{ binding?: ProxyBinding; knownAddresses?: string[]; knownDomains?: string[] }>()
const emit = defineEmits<{ (e: 'saved', id?: string): void; (e: 'cancel'): void }>()

const isEdit = !!props.binding?.id

function makeSlug() {
  return generateSlug(3, {
    partsOfSpeech: ['adjective', 'noun', 'noun'],
    categories: {
      noun: ['business', 'education', 'media', 'thing', 'technology', 'science'],
      adjective: ['appearance', 'condition', 'personality', 'quantity'],
    },
  })
}

// In create mode, proxy_address is split into localPart + domain
const existingProxyAddress = props.binding?.proxy_address ?? ''
const proxy_address = ref(existingProxyAddress) // used in edit mode display only
const localPart = ref(isEdit ? '' : makeSlug())
const domain = ref(props.knownDomains?.[0] ?? '')
const description = ref(props.binding?.description ?? '')
// For edit: local copy of real_addresses to toggle is_enabled
const editRealAddresses = ref<Record<string, RealAddress>>(
  JSON.parse(JSON.stringify(props.binding?.real_addresses ?? {}))
)
const selectedAddresses = ref<string[]>([])
const inputValue = ref('')
const showDropdown = ref(false)
const inputEl = ref<HTMLInputElement | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const editAddressCount = computed(() => Object.keys(editRealAddresses.value).length)

const filteredSuggestions = computed(() => {
  const val = inputValue.value.trim().toLowerCase()
  const inProxy = isEdit ? Object.keys(editRealAddresses.value) : []
  return (props.knownAddresses ?? []).filter(
    (a) =>
      !selectedAddresses.value.includes(a) &&
      !inProxy.includes(a) &&
      a.toLowerCase().includes(val),
  )
})

watch(
  () => props.binding,
  (b) => {
    proxy_address.value = b?.proxy_address ?? ''
    description.value = b?.description ?? ''
    editRealAddresses.value = JSON.parse(JSON.stringify(b?.real_addresses ?? {}))
    selectedAddresses.value = []
    inputValue.value = ''
    localPart.value = ''
    domain.value = props.knownDomains?.[0] ?? ''
  },
)

function selectAddress(addr: string) {
  if (!selectedAddresses.value.includes(addr)) {
    selectedAddresses.value.push(addr)
  }
  inputValue.value = ''
  showDropdown.value = false
  nextTick(() => inputEl.value?.focus())
}

function onInputKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    const val = inputValue.value.trim()
    if (val) selectAddress(val)
  } else if (e.key === 'Backspace' && !inputValue.value && selectedAddresses.value.length) {
    selectedAddresses.value.pop()
  } else if (e.key === 'Escape') {
    showDropdown.value = false
  }
}

function removeAddress(addr: string) {
  selectedAddresses.value = selectedAddresses.value.filter((a) => a !== addr)
}

function removeEditAddress(addr: string) {
  const copy = { ...editRealAddresses.value }
  delete copy[addr]
  editRealAddresses.value = copy
}

function onBlur() {
  // Delay so click on dropdown option fires first
  setTimeout(() => {
    const val = inputValue.value.trim()
    if (val) selectAddress(val)
    showDropdown.value = false
  }, 150)
}

async function submit() {
  loading.value = true
  error.value = null
  try {
    const token = localStorage.getItem('api_token')
    const headers = {
      'Content-Type': 'application/json',
      Token: token ?? '',
    }

    if (isEdit) {
      const patchedAddresses: Record<string, { is_enabled: boolean }> = Object.fromEntries(
        Object.entries(editRealAddresses.value).map(([addr, val]) => [
          addr,
          { is_enabled: val.is_enabled },
        ])
      )
      for (const addr of selectedAddresses.value) {
        patchedAddresses[addr] = { is_enabled: true }
      }
      const res = await fetch(`/api/v1/proxy-bindings/${props.binding!.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          data: {
            type: 'proxy_bindings',
            attributes: { description: description.value, real_addresses: patchedAddresses },
          },
        }),
      })
      if (!res.ok) throw new Error('Failed to update proxy email')
    } else {
      const fullAddress = domain.value ? `${localPart.value}@${domain.value}` : localPart.value
      const res = await fetch('/api/v1/proxy-bindings', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          data: {
            type: 'proxy_bindings',
            attributes: {
              proxy_address: fullAddress,
              description: description.value,
              real_addresses: selectedAddresses.value,
            },
          },
        }),
      })
      if (!res.ok) throw new Error('Failed to create proxy email')
    }

    emit('saved', props.binding?.id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form @submit.prevent="submit">
    <h2>{{ isEdit ? 'Edit Proxy Email' : 'New Proxy Email' }}</h2>

    <div v-if="isEdit" class="field">
      <label for="proxy_address">Proxy Address</label>
      <input id="proxy_address" v-model="proxy_address" disabled />
    </div>

    <div v-else class="field">
      <label>Proxy Address</label>
      <div class="proxy-address-split">
        <input
          v-model="localPart"
          class="proxy-local"
          placeholder="local-part"
          required
          autocomplete="off"
          spellcheck="false"
        />
        <button type="button" class="proxy-refresh" title="Generate new name" @click="localPart = makeSlug()">&#x21BA;</button>
        <span class="proxy-at">@</span>
        <select v-model="domain" class="proxy-domain" required>
          <option v-for="d in knownDomains" :key="d" :value="d">{{ d }}</option>
        </select>
      </div>
    </div>

    <div class="field">
      <label for="description">Description</label>
      <input id="description" v-model="description" />
    </div>

    <div v-if="isEdit" class="field">
      <label>Real Addresses</label>
      <div class="real-address-list">
        <div
          v-for="(addrData, addr) in editRealAddresses"
          :key="addr"
          class="real-address-row"
        >
          <span class="real-address-email">{{ addr }}</span>
          <span v-if="!addrData.is_verified" class="badge-unverified">Unverified</span>
          <button
            type="button"
            class="addr-toggle"
            :class="{ enabled: addrData.is_enabled }"
            :title="addrData.is_enabled ? 'Disable' : 'Enable'"
            @click="addrData.is_enabled = !addrData.is_enabled"
          >
            <span class="toggle-track"><span class="toggle-thumb" /></span>
          </button>
          <button
            type="button"
            class="addr-remove"
            :disabled="editAddressCount <= 1"
            title="Remove address"
            @click="removeEditAddress(String(addr))"
          >&#x2715;</button>
        </div>
        <div v-if="Object.keys(editRealAddresses).length === 0" class="no-addresses">
          No real addresses configured.
        </div>
      </div>
    </div>

    <div class="field">
      <label>{{ isEdit ? 'Add New Address' : 'Real Addresses' }}</label>
      <div class="combobox" @click="inputEl?.focus()">
        <span v-for="addr in selectedAddresses" :key="addr" class="tag">
          {{ addr }}
          <button type="button" class="tag-remove" @click.stop="removeAddress(addr)">&#x2715;</button>
        </span>
        <div class="combobox-input-wrap">
          <input
            ref="inputEl"
            v-model="inputValue"
            class="combobox-input"
            placeholder="Type or pick an address…"
            autocomplete="off"
            :required="!isEdit && selectedAddresses.length === 0"
            @focus="showDropdown = true"
            @blur="onBlur"
            @input="showDropdown = true"
            @keydown="onInputKeydown"
          />
        </div>
        <ul v-if="showDropdown && filteredSuggestions.length" class="dropdown">
          <li
            v-for="addr in filteredSuggestions"
            :key="addr"
            @mousedown.prevent="selectAddress(addr)"
          >
            {{ addr }}
          </li>
        </ul>
      </div>
      <small>Press Enter or comma to add. Click ✕ to remove.</small>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="actions">
      <button type="submit" :disabled="loading">{{ loading ? 'Saving…' : 'Save' }}</button>
      <button type="button" @click="emit('cancel')">Cancel</button>
    </div>
  </form>
</template>

<style scoped>
form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.proxy-address-split {
  display: flex;
  align-items: center;
  gap: 0;
  border: 1px solid var(--color-border, #ccc);
  border-radius: 4px;
  overflow: hidden;
  background: var(--color-background, #fff);
}

.proxy-local {
  flex: 1;
  border: none;
  outline: none;
  padding: 0.45rem 0.6rem;
  font-family: monospace;
  background: transparent;
  min-width: 0;
}

.proxy-at {
  padding: 0 0.25rem;
  font-family: monospace;
  color: var(--color-text, #555);
  user-select: none;
  flex-shrink: 0;
}

.proxy-refresh {
  border: none;
  border-left: 1px solid var(--color-border, #ccc);
  background: var(--color-background-soft, #f8f8f8);
  padding: 0.45rem 0.5rem;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  color: var(--color-text, #555);
  flex-shrink: 0;
  transition: background 0.15s;
}

.proxy-refresh:hover {
  background: var(--color-background-mute, #eee);
}

.proxy-domain {
  border: none;
  border-left: 1px solid var(--color-border, #ccc);
  outline: none;
  padding: 0.45rem 0.5rem;
  background: var(--color-background-soft, #f8f8f8);
  font-family: monospace;
  cursor: pointer;
  flex-shrink: 0;
}

label {
  font-size: 0.875rem;
  font-weight: 500;
}

.real-address-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 4px;
  background: var(--color-background-soft, #f8f8f8);
}

.real-address-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.real-address-email {
  flex: 1;
  font-family: monospace;
  font-size: 0.875rem;
}

.badge-unverified {
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: #fef9c3;
  color: #854d0e;
}

@media (prefers-color-scheme: dark) {
  .badge-unverified {
    background: #422006;
    color: #fde68a;
  }
}

.no-addresses {
  font-size: 0.8rem;
  opacity: 0.5;
}

.addr-remove {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.15rem 0.3rem;
  font-size: 0.85rem;
  color: #c00;
  opacity: 0.7;
  flex-shrink: 0;
  border-radius: 3px;
}

.addr-remove:hover:not(:disabled) {
  opacity: 1;
  background: #fee2e2;
}

.addr-remove:disabled {
  opacity: 0.2;
  cursor: not-allowed;
}

.addr-toggle {
  display: inline-flex;
  align-items: center;
  background: none;
  border: none;
  padding: 0.2rem;
  cursor: pointer;
  opacity: 0.5;
  flex-shrink: 0;
}

.addr-toggle.enabled {
  opacity: 1;
}

.addr-toggle .toggle-track {
  position: relative;
  display: inline-block;
  width: 2rem;
  height: 1.1rem;
  background: var(--color-border, #ccc);
  border-radius: 999px;
  transition: background 0.2s;
}

.addr-toggle.enabled .toggle-track {
  background: #4f46e5;
}

.addr-toggle .toggle-thumb {
  position: absolute;
  top: 0.15rem;
  left: 0.15rem;
  width: 0.8rem;
  height: 0.8rem;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}

.addr-toggle.enabled .toggle-thumb {
  transform: translateX(0.9rem);
}

input:not(.combobox-input) {
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 4px;
  font-size: 1rem;
}

.combobox {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 4px;
  background: var(--color-background, #fff);
  cursor: text;
  min-height: 2.4rem;
}

.combobox:focus-within {
  outline: 2px solid #4f46e5;
  outline-offset: -1px;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.5rem;
  background: #e0e7ff;
  color: #3730a3;
  border-radius: 999px;
  font-size: 0.8rem;
  white-space: nowrap;
}

@media (prefers-color-scheme: dark) {
  .tag {
    background: #312e81;
    color: #c7d2fe;
  }
}

.tag-remove {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  color: inherit;
  opacity: 0.6;
}

.tag-remove:hover {
  opacity: 1;
}

.combobox-input-wrap {
  flex: 1;
  min-width: 8rem;
}

.combobox-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.9rem;
  padding: 0.1rem 0.2rem;
  color: var(--color-text);
}

.dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 100;
  margin: 0.2rem 0 0;
  padding: 0.25rem 0;
  list-style: none;
  background: var(--color-background-soft, #fff);
  border: 1px solid var(--color-border, #ddd);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-height: 12rem;
  overflow-y: auto;
}

.dropdown li {
  padding: 0.4rem 0.75rem;
  font-size: 0.9rem;
  cursor: pointer;
}

.dropdown li:hover {
  background: #e0e7ff;
  color: #3730a3;
}

@media (prefers-color-scheme: dark) {
  .dropdown li:hover {
    background: #312e81;
    color: #c7d2fe;
  }
}

small {
  font-size: 0.75rem;
  color: var(--color-text);
  opacity: 0.5;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

button[type='submit'] {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  background: #4f46e5;
  color: #fff;
}

button[type='button'] {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  background: var(--color-border, #ddd);
  color: var(--color-text, #333);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: #dc2626;
  font-size: 0.875rem;
}
</style>
