<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

async function submit() {
  loading.value = true
  error.value = null
  try {
    await auth.login(username.value, password.value)
    router.push('/')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-wrapper">
    <form class="login-form" @submit.prevent="submit">
      <h1>ProxiedMail</h1>
      <p>Sign in to manage your proxy emails.</p>

      <div class="field">
        <label for="username">Username</label>
        <input id="username" v-model="username" type="text" autocomplete="username" required />
      </div>

      <div class="field">
        <label for="password">Password</label>
        <input
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
        />
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <button type="submit" :disabled="loading">
        {{ loading ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: var(--color-background, #f5f5f5);
}

.login-form {
  background: var(--color-background-soft, #fff);
  border: 1px solid var(--color-border, #ddd);
  border-radius: 8px;
  padding: 2rem;
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

h1 {
  margin: 0;
  font-size: 1.5rem;
}

p {
  margin: 0;
  color: var(--color-text-muted, #666);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

label {
  font-size: 0.875rem;
  font-weight: 500;
}

input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 4px;
  font-size: 1rem;
}

button {
  padding: 0.6rem;
  background: #4f46e5;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
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
