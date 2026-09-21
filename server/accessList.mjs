/**
 * Logique d'accès — fonctions pures, sans I/O, testées par Vitest.
 * Le fichier de liste est géré par server/index.mjs (jamais servi par HTTP).
 */

export function normalizeEmail(email) {
  return String(email ?? '')
    .trim()
    .toLowerCase()
}

export function isValidEmail(email) {
  const normalized = normalizeEmail(email)
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)
}

/**
 * Un visiteur est autorisé si son email est le superuser OU figure dans la
 * liste des emails acceptés (comparaison normalisée, insensible à la casse).
 */
export function isAllowedEmail(email, { superuserEmail, allowedEmails }) {
  const normalized = normalizeEmail(email)
  if (!normalized) return false
  if (normalizeEmail(superuserEmail) && normalized === normalizeEmail(superuserEmail)) {
    return true
  }
  return (allowedEmails ?? []).map(normalizeEmail).includes(normalized)
}

export function isSuperuserEmail(email, superuserEmail) {
  return normalizeEmail(email) !== '' && normalizeEmail(email) === normalizeEmail(superuserEmail)
}

/** Nettoie une liste d'emails : normalise, valide, déduplique. */
export function sanitizeEmailList(emails) {
  const cleaned = []
  const invalid = []
  for (const email of emails ?? []) {
    const normalized = normalizeEmail(email)
    if (!normalized) continue
    if (!isValidEmail(normalized)) {
      invalid.push(String(email))
      continue
    }
    if (!cleaned.includes(normalized)) cleaned.push(normalized)
  }
  return { cleaned, invalid }
}
