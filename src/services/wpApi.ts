import type { Attendee, RawWpAttendee, RawWpEvent, WpEvent } from '@/types/tickets'

/**
 * Toutes les requêtes passent par le proxy du serveur Node (`/wp-api/*`) :
 * les identifiants WordPress ne quittent jamais le serveur. Le token de
 * session (auth par email) est requis par le proxy.
 */
const PROXY_BASE = '/wp-api'

function sessionHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = localStorage.getItem('etp-auth-token') ?? ''
  return {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${PROXY_BASE}${path}`, { headers: sessionHeaders() })
  if (response.status === 401 || response.status === 403) {
    throw new Error('Session expirée — reconnectez-vous.')
  }
  if (!response.ok) {
    throw new Error(`Erreur API WordPress (${response.status}) : ${path}`)
  }
  return (await response.json()) as T
}

function eventTitle(raw: RawWpEvent): string {
  return typeof raw.title === 'string' ? raw.title : (raw.title?.rendered ?? '')
}

function normalizeEvent(raw: RawWpEvent): WpEvent {
  return {
    id: raw.id,
    title: eventTitle(raw),
    startDate: raw.start_date,
    endDate: raw.end_date,
  }
}

function decodeEntities(text: string): string {
  if (typeof document === 'undefined' || !text.includes('&')) return text
  const el = document.createElement('textarea')
  el.innerHTML = text
  return el.value
}

function toFieldValue(value: unknown): string {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map(toFieldValue).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return decodeEntities(String(value))
}

function ticketLabel(raw: RawWpAttendee): string {
  if (typeof raw.ticket === 'string') return raw.ticket
  if (raw.ticket) return raw.ticket.title ?? ''
  return raw.ticket_id != null ? String(raw.ticket_id) : ''
}

function normalizeAttendee(raw: RawWpAttendee): Attendee {
  const fields: Record<string, string> = {}
  for (const source of [raw.information, raw.attendee_meta, raw.meta]) {
    if (!source) continue
    for (const [key, value] of Object.entries(source)) {
      fields[key] = toFieldValue(value)
    }
  }
  return {
    id: raw.id,
    name: (raw.purchaser_name ?? raw.title ?? '').trim(),
    email: raw.purchaser_email ?? raw.email ?? '',
    ticket: ticketLabel(raw),
    ticketId: raw.ticket_id,
    checkedIn: raw.checked_in ?? false,
    fields,
  }
}

/** Un événement est actif s'il est public (« publish ») et pas encore terminé. */
function isActiveEvent(raw: RawWpEvent, today: string): boolean {
  if ((raw.status ?? 'publish') !== 'publish') return false
  return (raw.end_date ?? raw.start_date ?? today).slice(0, 10) >= today
}

/** Retourne la liste des événements à venir publiés sur le site WordPress. */
export async function fetchEvents(): Promise<WpEvent[]> {
  const data = await request<{ events?: RawWpEvent[] }>('/tribe/events/v1/events')
  const today = new Date().toISOString().slice(0, 10)
  return (data.events ?? []).filter((raw) => isActiveEvent(raw, today)).map(normalizeEvent)
}

type AttendeesPage = RawWpAttendee[] | { attendees?: RawWpAttendee[]; total_pages?: number }

/**
 * Retourne la liste des participants d'un événement (Event Tickets Plus).
 *
 * Le paramètre `event=` du endpoint est ignoré par certains sites (testé :
 * même réponse pour 1262, 1298 ou un id inexistant). On récupère donc toutes
 * les pages et on filtre côté client : on ne retient un participant que si
 * son événement (`post_id`) correspond à un événement public et actif.
 */
export async function fetchAttendees(eventId: number): Promise<Attendee[]> {
  const path = (page: number) => `/tribe/tickets/v1/attendees?per_page=100&page=${page}`
  const [events, first] = await Promise.all([fetchEvents(), request<AttendeesPage>(path(1))])
  const publicActiveEventIds = new Set(events.map((e) => e.id))

  const firstPage = Array.isArray(first) ? first : (first.attendees ?? [])
  const totalPages = Array.isArray(first) ? 1 : (first.total_pages ?? 1)

  const rest =
    totalPages <= 1
      ? []
      : await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) => request<AttendeesPage>(path(i + 2))),
        )
  return [firstPage, ...rest.map((p) => (Array.isArray(p) ? p : (p.attendees ?? [])))]
    .flat()
    .filter((raw) => raw.post_id === eventId && publicActiveEventIds.has(raw.post_id))
    .map(normalizeAttendee)
}

/** Check-in / check-out d'un participant (PATCH, paramètre `check_in`). */
export async function setCheckedIn(attendeeId: number, checked: boolean): Promise<void> {
  const response = await fetch(
    `${PROXY_BASE}/tribe/tickets/v1/attendees/${encodeURIComponent(attendeeId)}`,
    {
      method: 'PATCH',
      headers: sessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ check_in: checked }),
    },
  )
  if (response.status === 401 || response.status === 403) {
    throw new Error('Session expirée — reconnectez-vous.')
  }
  if (!response.ok) {
    throw new Error(
      `Échec du ${checked ? 'check-in' : 'check-out'} (${response.status}) pour le participant ${attendeeId}`,
    )
  }
}
