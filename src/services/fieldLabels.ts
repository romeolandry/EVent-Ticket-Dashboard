/**
 * Traduit les libellés des champs personnalisés WordPress (allemand) selon la
 * langue active. Les variantes du même champ (tirets, formulations) partagent
 * la même clé canonique ; un champ inconnu garde son libellé d'origine.
 */

type FieldId = 'arrivalFrom' | 'arrivalDay' | 'childrenCount' | 'children' | 'support'

/** L'ordre compte : les motifs les plus spécifiques d'abord. */
const FIELD_PATTERNS: [RegExp, FieldId][] = [
  [/ab wann willst du dabei sein/i, 'arrivalFrom'],
  [/wann kommen sie an/i, 'arrivalDay'],
  [/mitreisenden kinder/i, 'childrenCount'],
  [/^kinder$/i, 'children'],
  [/unterstützen/i, 'support'],
]

/** Clé canonique d'un champ personnalisé, ou null si inconnu. */
export function canonicalFieldKey(key: string): FieldId | null {
  return FIELD_PATTERNS.find(([pattern]) => pattern.test(key))?.[1] ?? null
}

/** Libellé affichable du champ : traduit si connu, brut sinon. */
export function fieldLabel(key: string, t: (key: string) => string): string {
  const id = canonicalFieldKey(key)
  return id ? t(`fields.${id}`) : key
}
