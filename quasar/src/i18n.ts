import { createI18n } from 'vue-i18n'
import en from './locales/en.yaml'
import es from './locales/es.yaml'

const messages = { en, es } as const

export type AppLocale = keyof typeof messages
const savedLocale = localStorage.getItem('proxiedmail.locale')
const locale: AppLocale = savedLocale === 'es' || savedLocale === 'en'
  ? savedLocale
  : navigator.language.startsWith('es')
    ? 'es'
    : 'en'

export const i18n = createI18n({
  legacy: false,
  locale,
  fallbackLocale: 'en',
  messages,
})
