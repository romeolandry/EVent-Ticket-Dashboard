import { describe, it, expect } from 'vitest'
import { canonicalFieldKey, fieldLabel } from '@/services/fieldLabels'
import fr from '@/i18n/fr'
import de from '@/i18n/de'
import en from '@/i18n/en'

describe('canonicalFieldKey', () => {
  it.each([
    ['Ab wann willst du dabei sein?', 'arrivalFrom'],
    ['Wann kommen Sie an?', 'arrivalDay'],
    ['Anzahl der mitreisenden Kinder (8-14 Jahr)', 'childrenCount'],
    ['Anzahl der mitreisenden Kinder (8–14 Jahre)', 'childrenCount'],
    ['Kinder', 'children'],
    ['Willst du unterstützen?', 'support'],
  ])('« %s » → %s', (key, expected) => {
    expect(canonicalFieldKey(key)).toBe(expected)
  })

  it('retourne null pour un champ inconnu', () => {
    expect(canonicalFieldKey('entreprise')).toBeNull()
  })
})

describe('fieldLabel', () => {
  function makeT(messages: typeof fr) {
    return (key: string): string => {
      let current: unknown = messages
      for (const part of key.split('.')) {
        current = (current as Record<string, unknown>)[part]
      }
      return String(current)
    }
  }
  const tFr = makeT(fr)
  const tDe = makeT(de)
  const tEn = makeT(en)

  it('traduit « Ab wann willst du dabei sein? »', () => {
    expect(fieldLabel('Ab wann willst du dabei sein?', tFr)).toBe(
      'À partir de quand serez-vous présent ?',
    )
    expect(fieldLabel('Ab wann willst du dabei sein?', tEn)).toBe('When will you arrive?')
    expect(fieldLabel('Ab wann willst du dabei sein?', tDe)).toBe('Ab wann willst du dabei sein?')
  })

  it('traduit les deux variantes « Anzahl der mitreisenden Kinder … »', () => {
    for (const variant of [
      'Anzahl der mitreisenden Kinder (8-14 Jahr)',
      'Anzahl der mitreisenden Kinder (8–14 Jahre)',
    ]) {
      expect(fieldLabel(variant, tFr)).toBe('Nombre d’enfants accompagnants (8–14 ans)')
      expect(fieldLabel(variant, tEn)).toBe('Number of accompanying children (8–14)')
    }
  })

  it('garde le libellé brut pour un champ inconnu', () => {
    expect(fieldLabel('entreprise', tFr)).toBe('entreprise')
  })
})
