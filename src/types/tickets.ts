/**
 * Types liés à l'API WordPress (The Events Calendar / Event Tickets Plus).
 *
 * Événements : GET /wp-json/tribe/events/v1/events
 * Participants : GET /wp-json/tribe/tickets/v1/attendees?event=<id>
 */

/** Événement tel que retourné par l'API The Events Calendar (REST v1). */
export interface RawWpEvent {
  id: number
  title: string | { rendered: string }
  start_date?: string
  end_date?: string
  url?: string
}

/** Événement normalisé utilisé dans l'application. */
export interface WpEvent {
  id: number
  title: string
  startDate?: string
  endDate?: string
}

/**
 * Participant brut retourné par l'API Event Tickets (REST v1).
 * Les champs personnalisés (Event Tickets Plus) sont exposés de façon
 * variable selon la configuration du site : `attendee_meta` et/ou `meta`.
 */
export interface RawWpAttendee {
  id: number
  title?: string
  purchaser_name?: string
  purchaser_email?: string
  ticket_id?: number
  ticket?: string
  checked_in?: boolean
  attendee_meta?: Record<string, unknown>
  meta?: Record<string, unknown>
}

/** Participant normalisé ; `fields` contient les champs dynamiques créés dans WordPress. */
export interface Attendee {
  id: number
  name: string
  email: string
  ticket: string
  checkedIn: boolean
  fields: Record<string, string>
}
