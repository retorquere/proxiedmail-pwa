import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { i18n } from '../i18n'

const SUPPORTED = ['en', 'nl'] as const
export type SupportedLocale = (typeof SUPPORTED)[number]

const LOCALE_KEY = 'app_locale'

function detectLocale(): SupportedLocale {
  const stored = localStorage.getItem(LOCALE_KEY)
  if (stored && SUPPORTED.includes(stored as SupportedLocale)) {
    return stored as SupportedLocale
  }
  const browser = navigator.language.split('-')[0]
  if (SUPPORTED.includes(browser as SupportedLocale)) {
    return browser as SupportedLocale
  }
  return 'en'
}

export const useLocaleStore = defineStore('locale', () => {
  const locale = ref<SupportedLocale>(detectLocale())

  // Keep vue-i18n in sync
  watch(locale, (val) => {
    i18n.global.locale.value = val
    localStorage.setItem(LOCALE_KEY, val)
    document.documentElement.lang = val
  }, { immediate: true })

  function setLocale(val: SupportedLocale) {
    locale.value = val
  }

  return { locale, setLocale, supported: SUPPORTED }
})
