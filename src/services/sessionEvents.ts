/**
 * Événement émis quand le proxy répond 401/403 : la session stockée n'est
 * plus valide (tokens en mémoire côté serveur, perdus au redémarrage).
 * App.vue l'écoute pour déconnecter l'utilisateur et rouvrir /login.
 */
export const SESSION_EXPIRED_EVENT = 'etp:session-expired'

export function notifySessionExpired() {
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
}
