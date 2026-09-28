import { createI18n } from 'vue-i18n'
import fr from './fr'
import en from './en'
import de from './de'

export type AppLocale = 'fr' | 'en' | 'de'
export const SUPPORTED_LOCALES: AppLocale[] = ['fr', 'en', 'de']
export const LOCALE_FLAGS: Record<AppLocale, string> = {
  fr: '🇫🇷',
  en: '🇬🇧',
  de: '🇩🇪',
}
export type MessageSchema = typeof fr

const STORAGE_KEY = 'etp-locale'

function initialLocale(): AppLocale {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (SUPPORTED_LOCALES.includes(saved as AppLocale)) return saved as AppLocale
  const nav = navigator.language.slice(0, 2) as AppLocale
  return SUPPORTED_LOCALES.includes(nav) ? nav : 'fr'
}

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale(),
  fallbackLocale: 'fr',
  messages: { fr, en, de },
})

export function setLocale(locale: AppLocale) {
  i18n.global.locale.value = locale
  localStorage.setItem(STORAGE_KEY, locale)
}
