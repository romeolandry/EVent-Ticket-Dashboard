export interface AuthSession {
  token: string
  email: string
  isSuperuser: boolean
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  const body = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(body.error ?? `Erreur ${response.status}`)
  return body
}

/** Connexion : réussit seulement si l'email est autorisé côté serveur. */
export function login(email: string): Promise<AuthSession> {
  return api<AuthSession>('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
}

export function logout(token: string): Promise<void> {
  return api('/api/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function fetchAccessList(token: string): Promise<{ emails: string[] }> {
  return api('/api/access-list', { headers: { Authorization: `Bearer ${token}` } })
}

export function saveAccessList(
  token: string,
  emails: string[],
): Promise<{ emails: string[] }> {
  return api('/api/access-list', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ emails }),
  })
}
