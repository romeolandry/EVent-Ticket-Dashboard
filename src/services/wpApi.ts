import type { Attendee, RawWpAttendee, RawWpEvent, WpEvent } from '@/types/tickets'

const BASE_URL = (import.meta.env.VITE_WP_API_URL ?? '').replace(/\/$/, '')
const AUTH_USER = import.meta.env.VITE_WP_AUTH_USER ?? ''
const AUTH_PASSWORD = import.meta.env.VITE_WP_AUTH_PASSWORD ?? ''

async function request<T>(path: string): Promise<T> {
  if (!BASE_URL) {
    throw new Error("VITE_WP_API_URL n'est pas configurée (voir .env.example).")
  }
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (AUTH_USER && AUTH_PASSWORD) {
    headers.Authorization = `Basic ${btoa(`${AUTH_USER}:${AUTH_PASSWORD}`)}`
  }
  const response = await fetch(`${BASE_URL}${path}`, { headers })
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

function toFieldValue(value: unknown): string {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map(toFieldValue).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function normalizeAttendee(raw: RawWpAttendee): Attendee {
  const fields: Record<string, string> = {}
  for (const source of [raw.attendee_meta, raw.meta]) {
    if (!source) continue
    for (const [key, value] of Object.entries(source)) {
      fields[key] = toFieldValue(value)
    }
  }
  return {
    id: raw.id,
    name: raw.purchaser_name ?? raw.title ?? '',
    email: raw.purchaser_email ?? '',
    ticket: raw.ticket ?? (raw.ticket_id != null ? String(raw.ticket_id) : ''),
    checkedIn: raw.checked_in ?? false,
    fields,
  }
}

/** Retourne la liste des événements publiés sur le site WordPress. */
export async function fetchEvents(): Promise<WpEvent[]> {
  const data = await request<{ events?: RawWpEvent[] }>('/wp-json/tribe/events/v1/events')
  return (data.events ?? []).map(normalizeEvent)
}

/** Retourne la liste des participants d'un événement (Event Tickets Plus). */
export async function fetchAttendees(eventId: number): Promise<Attendee[]> {
  const data = await request<RawWpAttendee[] | { attendees?: RawWpAttendee[] }>(
    `/wp-json/tribe/tickets/v1/attendees?event=${encodeURIComponent(eventId)}&per_page=100`,
  )
  const rawList = Array.isArray(data) ? data : (data.attendees ?? [])
  return rawList.map(normalizeAttendee)
}
