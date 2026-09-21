import { createI18n } from 'vue-i18n'
import fr from '@/i18n/fr'
import en from '@/i18n/en'
import de from '@/i18n/de'

/** Instance i18n pour les tests (locale par défaut : fr). */
export function createTestI18n() {
  return createI18n({
    legacy: false,
    locale: 'fr',
    fallbackLocale: 'fr',
    messages: { fr, en, de },
  })
}
