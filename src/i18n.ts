import { createI18n } from 'vue-i18n'
import en from './locales/en.yaml'
import es from './locales/es.yaml'
import nl from './locales/nl.yaml'

const messages = { en, es, nl } as const

export type AppLocale = keyof typeof messages
const savedLocale = localStorage.getItem('proxiedmail.locale')
const locale: AppLocale = savedLocale === 'es' || savedLocale === 'en' || savedLocale === 'nl'
  ? savedLocale
  : navigator.language.startsWith('es')
    ? 'es'
    : navigator.language.startsWith('nl')
      ? 'nl'
      : 'en'

export const i18n = createI18n({
  legacy: false,
  locale,
  fallbackLocale: 'en',
  messages,
})
