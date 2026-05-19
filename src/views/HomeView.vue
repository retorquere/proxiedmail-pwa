<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import ContactList from '../components/ContactList.vue'
import ProxyEmailForm from '../components/ProxyEmailForm.vue'
import ProxyEmailList from '../components/ProxyEmailList.vue'
import SettingsMenu from '../components/SettingsMenu.vue'
import { useAuthStore } from '../stores/auth'
import type { ProxyBinding } from '../types/proxy-binding'
import { apiFetch } from '../utils/api'

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()
const listRef = ref<InstanceType<typeof ProxyEmailList> | null>(null)

// --- pull-to-refresh ---
const PULL_THRESHOLD = 72
const pullY = ref(0)
const pulling = ref(false)
const refreshing = ref(false)
let touchStartY = 0

function onTouchStart(e: TouchEvent) {
  if (window.scrollY > 0) return
  touchStartY = e.touches[0]?.clientY ?? 0
}

function onTouchMove(e: TouchEvent) {
  if (refreshing.value) return
  const delta = (e.touches[0]?.clientY ?? touchStartY) - touchStartY
  if (delta <= 0) {
    pulling.value = false
    pullY.value = 0
    return
  }
  // Rubber-band damping
  pulling.value = true
  pullY.value = Math.min(delta * 0.45, PULL_THRESHOLD * 1.2)
}

async function onTouchEnd() {
  if (!pulling.value) return
  pulling.value = false
  if (pullY.value >= PULL_THRESHOLD * 0.45) {
    refreshing.value = true
    pullY.value = PULL_THRESHOLD * 0.6
    await listRef.value?.fetchProxyBindings()
    refreshing.value = false
  }
  pullY.value = 0
}
// --- end pull-to-refresh ---

const activeTab = ref<'proxies' | 'contacts'>('proxies')
const contactsActivated = ref(false)
watch(activeTab, (tab) => {
  if (tab === 'contacts') contactsActivated.value = true
})

const formVisible = ref(false)
const editingBinding = ref<ProxyBinding | undefined>(undefined)

function showCreate() {
  editingBinding.value = undefined
  formVisible.value = true
}

function onEdit(binding: ProxyBinding) {
  editingBinding.value = binding
  formVisible.value = true
}

function onOpenProxy(binding: ProxyBinding) {
  activeTab.value = 'proxies'
  onEdit(binding)
}

const deleteModal = ref<
  {
    binding: ProxyBinding
    confirmed: boolean
    deleting: boolean
    error: string | null
  } | null
>(null)

function onDelete(binding: ProxyBinding) {
  deleteModal.value = {
    binding,
    confirmed: false,
    deleting: false,
    error: null,
  }
}

async function confirmDelete() {
  if (!deleteModal.value?.confirmed) return
  deleteModal.value.deleting = true
  deleteModal.value.error = null
  try {
    const res = await apiFetch(
      `/api/v1/proxy-bindings/${deleteModal.value.binding.id}`,
      {
        method: 'DELETE',
        headers: { Token: localStorage.getItem('api_token') ?? '' },
      },
    )
    if (!res.ok) throw new Error('Delete failed')
    deleteModal.value = null
    listRef.value?.fetchProxyBindings()
  }
  catch (e) {
    if (deleteModal.value) {
      deleteModal.value.error = e instanceof Error ? e.message : t('delete.failed')
      deleteModal.value.deleting = false
    }
  }
}

function onSaved(savedId?: string) {
  formVisible.value = false
  editingBinding.value = undefined
  listRef.value?.fetchProxyBindings({ background: true, highlightId: savedId })
}

function onCancel() {
  formVisible.value = false
  editingBinding.value = undefined
}

function logout() {
  auth.clearToken()
  router.push('/login')
}
</script>

<template>
  <div
    class="page"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend="onTouchEnd"
  >
    <div
      class="ptr-indicator"
      :style="{
        transform: `translateY(${pullY}px)`,
        opacity: pulling || refreshing ? 1 : 0,
      }"
      aria-hidden="true"
    >
      <svg
        class="ptr-spinner"
        :class="{ spinning: refreshing }"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
      >
        <path d="M21 12a9 9 0 1 1-6.22-8.56" />
      </svg>
    </div>
    <header class="page-header">
      <h1>{{ t('app.name') }}</h1>
      <div class="header-actions">
        <button v-if="!formVisible && activeTab === 'proxies'" @click="showCreate">
          {{ t('home.newProxy') }}
        </button>
        <SettingsMenu @signout="logout" />
      </div>
    </header>

    <nav v-if="!formVisible" class="tabs">
      <button
        class="tab"
        :class="{ active: activeTab === 'proxies' }"
        @click="activeTab = 'proxies'"
      >
        {{ t('home.tabProxies') }}
      </button>
      <button
        class="tab"
        :class="{ active: activeTab === 'contacts' }"
        @click="activeTab = 'contacts'"
      >
        {{ t('home.tabContacts') }}
      </button>
    </nav>

    <ProxyEmailForm
      v-if="formVisible"
      :binding="editingBinding"
      :known-addresses="[
        ...new Set([
          ...(auth.loginUsername ? [auth.loginUsername] : []),
          ...(listRef?.allRealAddresses ?? []),
        ]),
      ]"
      :known-domains="listRef?.allDomains ?? []"
      @saved="onSaved"
      @cancel="onCancel"
    />

    <ProxyEmailList
      v-show="!formVisible && activeTab === 'proxies'"
      ref="listRef"
      @edit="onEdit"
      @delete="onDelete"
    />

    <ContactList
      v-if="contactsActivated"
      v-show="!formVisible && activeTab === 'contacts'"
      :proxy-bindings="listRef?.proxyBindings ?? []"
      @open-proxy="onOpenProxy"
    />

    <Teleport to="body">
      <div
        v-if="deleteModal"
        class="modal-backdrop"
        @click.self="deleteModal = null"
      >
        <div
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div class="modal-icon">⚠️</div>
          <h2 id="modal-title">{{ t('delete.title') }}</h2>
          <p class="modal-address">{{ deleteModal.binding.proxy_address }}</p>
          <p class="modal-warning">{{ t('delete.warning') }}</p>
          <label class="modal-checkbox">
            <input
              type="checkbox"
              v-model="deleteModal.confirmed"
              :disabled="deleteModal.deleting"
            />
            {{ t('delete.confirm') }}
          </label>
          <p v-if="deleteModal.error" class="modal-error">
            {{ deleteModal.error }}
          </p>
          <div class="modal-actions">
            <button
              class="btn-cancel"
              :disabled="deleteModal.deleting"
              @click="deleteModal = null"
            >
              {{ t('delete.cancel') }}
            </button>
            <button
              class="btn-confirm-delete"
              :disabled="!deleteModal.confirmed || deleteModal.deleting"
              @click="confirmDelete"
            >
              {{ deleteModal.deleting ? t('delete.deleting') : t('delete.delete') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.page {
  margin: 0 auto;
  padding: 0.5rem;
  position: relative;
}

@media (min-width: 600px) {
  .page {
    max-width: 800px;
    padding: 1.5rem;
  }
}

/* Pull-to-refresh */
.ptr-indicator {
  position: absolute;
  top: -2.5rem;
  left: 50%;
  transform: translateX(-50%);
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s;
  pointer-events: none;
}

.ptr-spinner {
  width: 1.5rem;
  height: 1.5rem;
  color: #4f46e5;
  transition: transform 0.15s;
}

.ptr-spinner.spinning {
  animation: ptr-spin 0.8s linear infinite;
}

@keyframes ptr-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tabs {
  display: flex;
  margin-bottom: 1.25rem;
  border-bottom: 2px solid var(--color-border);
}

.tab {
  padding: 0.5rem 1.25rem;
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  background: none;
  color: var(--color-text);
  font-size: 0.9rem;
  cursor: pointer;
  opacity: 0.6;
  margin-bottom: -2px;
  transition: opacity 0.15s, border-color 0.15s, color 0.15s;
}

.tab:hover {
  opacity: 0.9;
}

.tab.active {
  border-bottom-color: #4f46e5;
  color: #4f46e5;
  opacity: 1;
  font-weight: 600;
}

@media (prefers-color-scheme: dark) {
  .tab.active {
    color: #a5b4fc;
    border-bottom-color: #a5b4fc;
  }
}

.page-header h1 {
  margin: 0;
  font-size: 1.5rem;
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  background: #4f46e5;
  color: #fff;
}

.btn-logout {
  background: var(--color-border, #ddd);
  color: var(--color-text, #333);
}

/* Delete confirmation modal */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--color-background, #fff);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 2rem;
  max-width: 420px;
  width: calc(100% - 2rem);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.modal-icon {
  font-size: 2rem;
  line-height: 1;
}

.modal h2 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--color-heading);
}

.modal-address {
  margin: 0;
  font-family: monospace;
  font-size: 0.9rem;
  background: var(--color-background-soft);
  padding: 0.35rem 0.6rem;
  border-radius: 4px;
  color: var(--color-heading);
  word-break: break-all;
}

.modal-warning {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text);
  opacity: 0.8;
}

.modal-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
  color: var(--color-text);
}

.modal-checkbox input {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
  flex-shrink: 0;
  accent-color: #dc2626;
}

.modal-error {
  margin: 0;
  font-size: 0.825rem;
  color: #dc2626;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.btn-cancel {
  background: var(--color-border, #ddd);
  color: var(--color-text, #333);
}

.btn-confirm-delete {
  background: #dc2626;
  color: #fff;
}

.btn-confirm-delete:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
