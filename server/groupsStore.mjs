/**
 * Logique des groupes de travail — fonctions pures, sans I/O, testées par
 * Vitest. Le stockage SQLite est géré par server/groupsDb.mjs.
 */
import { sanitizeEmailList } from './accessList.mjs'

const DEFAULT_GROUP_COUNT = 4

/** Nom du fichier de persistance d'un événement (null si id invalide). */
export function groupsFileName(eventId) {
  const id = Number(eventId)
  if (!Number.isInteger(id) || id <= 0) return null
  return `groups-${id}.json`
}

/**
 * Nettoie un état { count, map, excludeEmails } reçu d'un client ou lu
 * depuis le disque :
 * - count         : entier >= 1 (sinon valeur par défaut)
 * - map           : attendeeId (entier > 0) → numéro de groupe (entier 1..count)
 *                   les entrées invalides ou hors limites sont ignorées
 * - excludeEmails : emails normalisés/valides/dédupliqués — participants
 *                   exclus de la répartition automatique pour l'événement.
 */
export function sanitizeGroupState(value) {
  const input = value && typeof value === 'object' ? value : {}
  const count =
    Number.isInteger(input.count) && input.count >= 1 ? input.count : DEFAULT_GROUP_COUNT

  const map = {}
  if (input.map && typeof input.map === 'object' && !Array.isArray(input.map)) {
    for (const [key, group] of Object.entries(input.map)) {
      const attendeeId = Number(key)
      const groupNumber = Number(group)
      if (!Number.isInteger(attendeeId) || attendeeId <= 0) continue
      if (!Number.isInteger(groupNumber) || groupNumber < 1 || groupNumber > count) continue
      map[attendeeId] = groupNumber
    }
  }

  const excludeEmails = Array.isArray(input.excludeEmails)
    ? sanitizeEmailList(input.excludeEmails).cleaned
    : []

  return { count, map, excludeEmails }
}
