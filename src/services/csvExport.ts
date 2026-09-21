import type { Attendee } from '@/types/tickets'

/**
 * CSV compatible Excel (locales FR/DE) : séparateur « ; », BOM UTF-8,
 * guillemets doublés, cellules contenant « ; » « " » ou saut de ligne quotées.
 */
export function attendeesToCsv(attendees: Attendee[]): string {
  const fieldKeys = [...new Set(attendees.flatMap((a) => Object.keys(a.fields)))]
  const header = ['Nom', 'Email', 'Billet', 'Présent', ...fieldKeys]
  const rows = attendees.map((a) => [
    a.name,
    a.email,
    a.ticket,
    a.checkedIn ? 'Oui' : 'Non',
    ...fieldKeys.map((key) => a.fields[key] ?? ''),
  ])

  const escape = (value: string): string =>
    /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
  return '\uFEFF' + [header, ...rows].map((row) => row.map(escape).join(';')).join('\r\n')
}
