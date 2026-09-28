/**
 * Persistance SQLite des groupes de travail — node:sqlite (embarqué dans
 * Node 22+, aucune dépendance native).
 *
 * Schéma (fichier DATA_DIR/groups.db) :
 * - event_group_count(event_id, count)        → nombre de groupes par événement
 * - attendee_group(event_id, attendee_id, group_number)
 *     → une ligne par participant : son groupe est (ré)écrit à chaque
 *       changement d'assignation côté serveur.
 *
 * Les événements passent par isValidEventId → jamais de traversée de chemin.
 */
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const DEFAULT_GROUP_COUNT = 4

/** Retourne l'id entier valide d'un événement, ou null. */
export function isValidEventId(eventId) {
  const id = Number(eventId)
  return Number.isInteger(id) && id > 0 ? id : null
}

/** Ouvre la base (dataDir ou ':memory:' pour les tests) et crée le schéma. */
export function openGroupsDb(dataDir) {
  if (dataDir !== ':memory:') mkdirSync(dataDir, { recursive: true })
  const db = new DatabaseSync(dataDir === ':memory:' ? ':memory:' : join(dataDir, 'groups.db'))
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS event_group_count (
      event_id INTEGER PRIMARY KEY,
      count INTEGER NOT NULL CHECK (count >= 1)
    );
    CREATE TABLE IF NOT EXISTS attendee_group (
      event_id INTEGER NOT NULL,
      attendee_id INTEGER NOT NULL,
      group_number INTEGER NOT NULL CHECK (group_number >= 1),
      PRIMARY KEY (event_id, attendee_id)
    );
  `)
  return db
}

/**
 * Lit l'état d'un événement : { count, map, saved }.
 * `saved` vaut false si l'événement n'a jamais été persisté.
 */
export function readGroupState(db, eventId) {
  const meta = db
    .prepare('SELECT count FROM event_group_count WHERE event_id = ?')
    .get(eventId)
  const rows = db
    .prepare(
      'SELECT attendee_id AS attendeeId, group_number AS groupNumber FROM attendee_group WHERE event_id = ?',
    )
    .all(eventId)
  const map = {}
  for (const row of rows) map[row.attendeeId] = row.groupNumber
  return {
    count: meta?.count ?? DEFAULT_GROUP_COUNT,
    map,
    saved: meta !== undefined || rows.length > 0,
  }
}

/**
 * Remplace l'état complet d'un événement (transaction) : le nombre de
 * groupes et une ligne par participant avec son groupe associé.
 */
export function saveGroupState(db, eventId, { count, map }) {
  db.exec('BEGIN')
  try {
    db.prepare(
      `INSERT INTO event_group_count (event_id, count) VALUES (?, ?)
       ON CONFLICT(event_id) DO UPDATE SET count = excluded.count`,
    ).run(eventId, count)
    db.prepare('DELETE FROM attendee_group WHERE event_id = ?').run(eventId)
    const insert = db.prepare(
      'INSERT INTO attendee_group (event_id, attendee_id, group_number) VALUES (?, ?, ?)',
    )
    for (const [attendeeId, groupNumber] of Object.entries(map)) {
      insert.run(eventId, Number(attendeeId), groupNumber)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
