import './assets/main.css'

import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import { i18n } from './i18n'
import router from './router'
import { useLocaleStore } from './stores/locale'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(i18n)

// Initialise locale: reads persisted choice from localStorage, or falls back
// to browser language, then 'en'. Runs on every app start regardless of auth state.
useLocaleStore()

app.mount('#app')
