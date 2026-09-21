import type { Attendee } from '@/types/tickets'

export interface CsvLabels {
  name: string
  email: string
  ticket: string
  present: string
  yes: string
  no: string
}

/**
 * CSV compatible Excel (locales FR/DE) : séparateur « ; », BOM UTF-8,
 * guillemets doublés, cellules contenant « ; » « " » ou saut de ligne quotées.
 */
export function attendeesToCsv(
  attendees: Attendee[],
  labels: CsvLabels = {
    name: 'Nom',
    email: 'Email',
    ticket: 'Billet',
    present: 'Présent',
    yes: 'Oui',
    no: 'Non',
  },
  /** Traduction des libellés de champs personnalisés (sinon : libellé brut). */
  fieldLabelFn: (key: string) => string = (key) => key,
): string {
  const fieldKeys = [...new Set(attendees.flatMap((a) => Object.keys(a.fields)))]
  const header = [
    labels.name,
    labels.email,
    labels.ticket,
    labels.present,
    ...fieldKeys.map(fieldLabelFn),
  ]
  const rows = attendees.map((a) => [
    a.name,
    a.email,
    a.ticket,
    a.checkedIn ? labels.yes : labels.no,
    ...fieldKeys.map((key) => a.fields[key] ?? ''),
  ])

  const escape = (value: string): string =>
    /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
  return '\uFEFF' + [header, ...rows].map((row) => row.map(escape).join(';')).join('\r\n')
}
