import { notifySessionExpired } from '@/services/sessionEvents'

/**
 * Paramètres applicatifs (ex. config d'impression des badges) persistés dans
 * la base SQLite du serveur (app_settings) et partagés entre tous les
 * utilisateurs connectés. Session (Bearer) requise.
 */
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

/** Lit un paramètre partagé ; null s'il n'a jamais été enregistré. */
export async function fetchSetting<T>(key: string): Promise<T | null> {
  const response = await fetch(`/api/settings?key=${encodeURIComponent(key)}`, {
    headers: sessionHeaders(),
  })
  checkAuth(response)
  if (!response.ok) {
    throw new Error(`Erreur chargement du paramètre ${key} (${response.status})`)
  }
  const data = (await response.json()) as { value: T | null }
  return data.value ?? null
}

/** Persiste un paramètre partagé (remplacé en entier). */
export async function saveSetting<T>(key: string, value: T): Promise<void> {
  const response = await fetch(`/api/settings?key=${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: sessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ value }),
  })
  checkAuth(response)
  if (!response.ok) {
    throw new Error(`Erreur sauvegarde du paramètre ${key} (${response.status})`)
  }
}
