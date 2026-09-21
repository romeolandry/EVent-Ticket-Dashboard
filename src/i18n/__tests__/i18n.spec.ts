import { describe, it, expect } from 'vitest'
import fr from '@/i18n/fr'
import en from '@/i18n/en'
import de from '@/i18n/de'
import { SUPPORTED_LOCALES, i18n, setLocale } from '@/i18n'

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? flattenKeys(value as Record<string, unknown>, `${prefix}${key}.`)
      : `${prefix}${key}`,
  )
}

describe('i18n', () => {
  it('toutes les locales exposent exactement les mêmes clés', () => {
    const frKeys = flattenKeys(fr).sort()
    expect(flattenKeys(en).sort()).toEqual(frKeys)
    expect(flattenKeys(de).sort()).toEqual(frKeys)
  })

  it('ne contient aucune chaîne vide', () => {
    const walk = (obj: Record<string, unknown>): string[] =>
      Object.values(obj).flatMap((v) =>
        typeof v === 'object' && v !== null ? walk(v as Record<string, unknown>) : [String(v)],
      )
    for (const locale of [fr, en, de]) {
      expect(walk(locale).every((s) => s.trim().length > 0)).toBe(true)
    }
  })

  it('setLocale change la langue active et la persiste', () => {
    expect(SUPPORTED_LOCALES).toEqual(['fr', 'en', 'de'])

    setLocale('de')
    expect(i18n.global.locale.value).toBe('de')
    expect(localStorage.getItem('etp-locale')).toBe('de')
    expect(i18n.global.t('dashboard.title')).toBe('Teilnehmer')

    setLocale('en')
    expect(i18n.global.t('dashboard.title')).toBe('Attendees')

    setLocale('fr')
    expect(i18n.global.t('dashboard.title')).toBe('Participants')
  })
})
