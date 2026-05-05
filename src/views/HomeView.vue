<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import ProxyEmailList from '../components/ProxyEmailList.vue'
import ProxyEmailForm from '../components/ProxyEmailForm.vue'
import type { ProxyBinding } from '../types/proxy-binding'

const auth = useAuthStore()
const router = useRouter()
const listRef = ref<InstanceType<typeof ProxyEmailList> | null>(null)

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

async function onDelete(binding: ProxyBinding) {
  if (!confirm(`Delete proxy email "${binding.proxy_address}"?`)) return
  try {
    const res = await fetch(
      `/api/v1/proxy-bindings/${binding.id}`,
      {
        method: 'DELETE',
        headers: { Token: localStorage.getItem('api_token') ?? '' },
      },
    )
    if (!res.ok) throw new Error('Delete failed')
    listRef.value?.fetchProxyBindings()
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Delete failed')
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
  <div class="page">
    <header class="page-header">
      <h1>ProxiedMail</h1>
      <div class="header-actions">
        <button v-if="!formVisible" @click="showCreate">+ New proxy email</button>
        <button class="btn-logout" @click="logout">Sign out</button>
      </div>
    </header>

    <ProxyEmailForm
      v-if="formVisible"
      :binding="editingBinding"
      :known-addresses="[...new Set([...(auth.loginUsername ? [auth.loginUsername] : []), ...(listRef?.allRealAddresses ?? [])])]"
      :known-domains="listRef?.allDomains ?? []"
      @saved="onSaved"
      @cancel="onCancel"
    />

    <ProxyEmailList v-show="!formVisible" ref="listRef" @edit="onEdit" @delete="onDelete" />
  </div>
</template>

<style scoped>
.page {
  max-width: 800px;
  margin: 0 auto;
  padding: 1.5rem;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.page-header h1 {
  margin: 0;
  font-size: 1.5rem;
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
</style>
