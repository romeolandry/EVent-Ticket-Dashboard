import type { Attendee } from '@/types/tickets'

const CHILDREN_KEY = /kinder/i
// Le jour d'arrivée porte un nom différent selon le formulaire du billet :
// « Wann kommen Sie an? » (conférence familles) / « Ab wann willst du dabei sein? »
const ARRIVAL_KEY = /wann kommen sie an|ab wann willst du dabei sein/i

const NUMBER_WORDS: Record<string, number> = {
  null: 0,
  ein: 1,
  eins: 1,
  eine: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  'fünf': 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
}

export interface ParsedChildren {
  /** Un libellé d'âge par enfant identifié ('< 1', '< 2', '3', …). */
  ages: string[]
  /** Enfants mentionnés sans âge précisé (nombre ou mot-nombre seul). */
  unknown: number
}

export interface ChildrenStats {
  total: number
  byAge: { age: string; count: number }[]
  unknown: number
}

export interface ArrivalStat {
  label: string
  count: number
}

/**
 * Analyse un champ « Kinder » en texte libre (allemand). Formes réellement
 * rencontrées sur le site : « 4 (5,5,3,1) », « 1x12 Jahre », « Zwei »,
 * « 1,3 und 5 Jahre », « 1 Kind (< 2 Jahre) », « 1 Kind (6 Monaten) »…
 */
export function parseChildrenField(rawValue: string): ParsedChildren {
  const ages: string[] = []
  let unknown = 0
  const value = rawValue.trim()
  if (!value || value === '/') return { ages, unknown }

  let rest = value
    .toLowerCase()
    .replace(/[×*]/g, 'x')
    .replace(/["„“”«»]/g, ' ')
    .replace(/&lt;/g, '<')

  const take = (pattern: RegExp, onMatch: (m: RegExpMatchArray) => void) => {
    rest = rest.replace(pattern, (full: string, ...args: unknown[]) => {
      onMatch([full, ...args] as RegExpMatchArray)
      return ' '
    })
  }

  // « < n Jahre » (moins de n ans), p. ex. « 1 Kind (< 2 Jahre) »
  take(/(\d+)?\s*(?:kind\w*\s*)?\(?\s*<\s*(\d+)\s*jahre?\s*\)?/gi, (m) => {
    ages.push(...Array(Number(m[1] ?? 1) || 1).fill(`< ${m[2]}`))
  })

  // « n Monate(n) » => moins d'un an, p. ex. « 1 Kind (6 Monaten) »
  take(/(\d+)?\s*(?:kind\w*\s*)?\(?\s*(\d+)\s*monat\w*\s*\)?/gi, (m) => {
    ages.push(...Array(Number(m[1] ?? 1) || 1).fill('< 1'))
  })

  // « count x age », p. ex. « 1x12 Jahre », « 2× 1 Jahre »
  take(/(\d+)\s*x\s*(\d+)/gi, (m) => {
    ages.push(...Array(Number(m[1])).fill(m[2]))
  })

  // Listes entre parenthèses, p. ex. « 4 (5,5,3,1) », « 3 Kinder ( 7Jahre, 5 Jahre …) »
  take(/(\d+)\s*(?:kind\w*\s*)?\(([^)]*)\)/gi, (m) => {
    const inner = (m[2] ?? '').match(/\d+/g) ?? []
    ages.push(...inner)
  })
  take(/\(([^)]*)\)/gi, (m) => {
    ages.push(...((m[1] ?? '').match(/\d+/g) ?? []))
  })

  // Âges en liste terminée par « Jahr(e) », p. ex. « 1,3 und 5 Jahre »
  take(/((?:\d+[\s,]+)*(?:und\s+)?\d+)\s*jahre?\s*(?:alt)?/gi, (m) => {
    ages.push(...((m[1] ?? '').match(/\d+/g) ?? []))
  })

  // Reste : nombre(s) ou mot(s)-nombre(s) seuls => enfants d'âge inconnu
  for (const token of rest.split(/\s+/).filter(Boolean)) {
    const cleaned = token.replace(/[^\p{L}\p{N}]/gu, '')
    if (!cleaned) continue
    if (/^\d+$/.test(cleaned)) unknown += Number(cleaned)
    else if (cleaned in NUMBER_WORDS) unknown += NUMBER_WORDS[cleaned] ?? 0
  }

  return { ages, unknown }
}

function ageSortKey(age: string): [number, number] {
  if (age.startsWith('<')) return [0, Number(age.slice(1).trim())]
  return [1, Number(age)]
}

/** Agrège les champs « Kinder » de tous les participants : enfants par âge. */
export function childrenStats(attendees: Attendee[]): ChildrenStats {
  const counts = new Map<string, number>()
  let unknown = 0
  for (const attendee of attendees) {
    for (const [key, value] of Object.entries(attendee.fields)) {
      if (!CHILDREN_KEY.test(key)) continue
      const parsed = parseChildrenField(value)
      unknown += parsed.unknown
      for (const age of parsed.ages) counts.set(age, (counts.get(age) ?? 0) + 1)
    }
  }
  const byAge = [...counts.entries()]
    .map(([age, count]) => ({ age, count }))
    .sort((a, b) => {
      const [groupA, nA] = ageSortKey(a.age)
      const [groupB, nB] = ageSortKey(b.age)
      return groupA - groupB || nA - nB
    })
  return {
    total: byAge.reduce((sum, { count }) => sum + count, 0) + unknown,
    byAge,
    unknown,
  }
}

/** Jour d'arrivée déclaré par le participant (quel que soit le nom du champ). */
export function arrivalDay(attendee: Attendee): string | undefined {
  for (const [key, value] of Object.entries(attendee.fields)) {
    if (!ARRIVAL_KEY.test(key)) continue
    const label = value.trim()
    if (label) return label
  }
  return undefined
}

/** Agrège les jours d'arrivée : nombre de participants par réponse. */
export function arrivalStats(attendees: Attendee[]): ArrivalStat[] {
  const counts = new Map<string, number>()
  for (const attendee of attendees) {
    const label = arrivalDay(attendee)
    if (label) counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}
