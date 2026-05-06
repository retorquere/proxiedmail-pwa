<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLocaleStore, type SupportedLocale } from '../stores/locale'

const emit = defineEmits<{ (e: 'signout'): void }>()
const { t } = useI18n()
const localeStore = useLocaleStore()
const open = ref(false)

const languages: { code: SupportedLocale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Nederlands' },
]

function select(code: SupportedLocale) {
  localeStore.setLocale(code)
  open.value = false
}

function signout() {
  open.value = false
  emit('signout')
}

function onBlur(e: FocusEvent) {
  // Close only when focus leaves the whole menu
  const related = e.relatedTarget as HTMLElement | null
  if (!related?.closest('.settings-menu')) {
    open.value = false
  }
}
</script>

<template>
  <div class="settings-menu" @blur.capture="onBlur">
    <button
      class="btn-settings"
      :aria-label="t('settings.title')"
      :aria-expanded="open"
      @click="open = !open"
    >
      <!-- Cog / gear icon -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        />
      </svg>
    </button>

    <div v-if="open" class="dropdown" role="menu">
      <p class="dropdown-label">{{ t('settings.language') }}</p>
      <button
        v-for="lang in languages"
        :key="lang.code"
        class="lang-option"
        :class="{ active: localeStore.locale === lang.code }"
        role="menuitem"
        @click="select(lang.code)"
      >
        {{ lang.label }}
      </button>
      <hr class="dropdown-divider" />
      <button class="signout-option" role="menuitem" @click="signout">
        {{ t('home.signOut') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.settings-menu {
  position: relative;
  display: inline-flex;
}

.btn-settings {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--color-text);
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.15s, background 0.15s;
}

.btn-settings:hover {
  opacity: 1;
  background: var(--color-border);
}

.btn-settings svg {
  width: 1.1rem;
  height: 1.1rem;
}

.dropdown {
  position: absolute;
  top: calc(100% + 0.4rem);
  right: 0;
  min-width: 10rem;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: 0.4rem;
  z-index: 200;
}

.dropdown-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text);
  opacity: 0.5;
  margin: 0.2rem 0.5rem 0.4rem;
}

.lang-option {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.4rem 0.75rem;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--color-text);
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.12s;
}

.lang-option:hover {
  background: var(--color-border);
}

.lang-option.active {
  font-weight: 600;
  color: #4f46e5;
}

@media (prefers-color-scheme: dark) {
  .lang-option.active {
    color: #a5b4fc;
  }
}

.dropdown-divider {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 0.3rem 0;
}

.signout-option {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.4rem 0.75rem;
  border: none;
  border-radius: 4px;
  background: none;
  color: #b91c1c;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.12s;
}

.signout-option:hover {
  background: #fee2e2;
}

@media (prefers-color-scheme: dark) {
  .signout-option {
    color: #fca5a5;
  }
  .signout-option:hover {
    background: #450a0a;
  }
}
</style>
