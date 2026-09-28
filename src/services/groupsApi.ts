import { notifySessionExpired } from '@/services/sessionEvents'

/**
 * Groupes de travail partagés : l'état { count, map } de chaque événement est
 * persisté côté serveur (DATA_DIR/groups-<eventId>.json) afin que tous les
 * clients connectés voient les mêmes assignations — y compris les groupes
 * définis manuellement. Session (Bearer) requise.
 */
export interface GroupState {
  count: number
  /** attendeeId → numéro de groupe */
  map: Record<number, number>
  /** Emails exclus de la répartition automatique pour cet événement. */
  excludeEmails: string[]
}

function sessionHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = localStorage.getItem('etp-auth-token') ?? ''
  return {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

function checkAuth(response: Response): void {
  if (response.status === 401 || response.status === 403) {
    notifySessionExpired()
    throw new Error('Session expirée — reconnectez-vous.')
  }
}

/** Charge l'état des groupes d'un événement (état par défaut si jamais sauvegardé). */
export async function fetchGroups(eventId: number): Promise<GroupState> {
  const response = await fetch(`/api/groups?event=${encodeURIComponent(eventId)}`, {
    headers: sessionHeaders(),
  })
  checkAuth(response)
  if (!response.ok) {
    throw new Error(`Erreur chargement des groupes (${response.status})`)
  }
  const data = (await response.json()) as Partial<GroupState>
  return {
    count: typeof data.count === 'number' && data.count >= 1 ? data.count : 4,
    map: data.map && typeof data.map === 'object' ? data.map : {},
    excludeEmails: Array.isArray(data.excludeEmails)
      ? data.excludeEmails.filter((e): e is string => typeof e === 'string')
      : [],
  }
}

/** Persiste l'état complet des groupes d'un événement (partagé entre clients). */
export async function saveGroups(eventId: number, state: GroupState): Promise<void> {
  const response = await fetch(`/api/groups?event=${encodeURIComponent(eventId)}`, {
    method: 'PUT',
    headers: sessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(state),
  })
  checkAuth(response)
  if (!response.ok) {
    throw new Error(`Erreur sauvegarde des groupes (${response.status})`)
  }
}
