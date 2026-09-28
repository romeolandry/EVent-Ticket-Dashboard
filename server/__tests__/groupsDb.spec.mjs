// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isValidEventId, openGroupsDb, readGroupState, saveGroupState } from '../groupsDb.mjs'

describe('server/groupsDb', () => {
  let db

  beforeEach(() => {
    db = openGroupsDb(':memory:')
  })

  afterEach(() => {
    db.close()
  })

  it('isValidEventId accepte les entiers positifs uniquement', () => {
    expect(isValidEventId(1262)).toBe(1262)
    expect(isValidEventId('1298')).toBe(1298)
    expect(isValidEventId('../../secret')).toBeNull()
    expect(isValidEventId('toto')).toBeNull()
    expect(isValidEventId(0)).toBeNull()
    expect(isValidEventId(-1)).toBeNull()
    expect(isValidEventId(12.5)).toBeNull()
    expect(isValidEventId(null)).toBeNull()
  })

  it('retourne l’état par défaut (non sauvegardé) pour un événement inconnu', () => {
    const state = readGroupState(db, 1)
    expect(state).toEqual({ count: 4, map: {}, saved: false })
  })

  it('sauvegarde une ligne par participant avec son groupe', () => {
    saveGroupState(db, 1262, { count: 3, map: { 101: 2, 102: 1, 103: 2 } })

    const rows = db
      .prepare(
        'SELECT attendee_id, group_number FROM attendee_group WHERE event_id = 1262 ORDER BY attendee_id',
      )
      .all()
    expect(rows).toEqual([
      { attendee_id: 101, group_number: 2 },
      { attendee_id: 102, group_number: 1 },
      { attendee_id: 103, group_number: 2 },
    ])

    expect(readGroupState(db, 1262)).toEqual({
      count: 3,
      map: { 101: 2, 102: 1, 103: 2 },
      saved: true,
    })
  })

  it('un changement réécrit le groupe du participant (mise à jour)', () => {
    saveGroupState(db, 1262, { count: 2, map: { 101: 1 } })
    saveGroupState(db, 1262, { count: 2, map: { 101: 2 } })

    const row = db
      .prepare('SELECT group_number FROM attendee_group WHERE event_id = 1262 AND attendee_id = 101')
      .get()
    expect(row.group_number).toBe(2)
    // Une seule ligne par participant
    expect(
      db.prepare('SELECT COUNT(*) AS n FROM attendee_group WHERE event_id = 1262').get().n,
    ).toBe(1)
  })

  it('les participants retirés de la map disparaissent de la base', () => {
    saveGroupState(db, 1262, { count: 2, map: { 101: 1, 102: 2 } })
    saveGroupState(db, 1262, { count: 2, map: { 102: 2 } })

    expect(readGroupState(db, 1262).map).toEqual({ 102: 2 })
  })

  it('les événements sont isolés les uns des autres', () => {
    saveGroupState(db, 1262, { count: 2, map: { 101: 1 } })
    saveGroupState(db, 1298, { count: 3, map: { 101: 3 } })

    expect(readGroupState(db, 1262)).toMatchObject({ count: 2, map: { 101: 1 } })
    expect(readGroupState(db, 1298)).toMatchObject({ count: 3, map: { 101: 3 } })
  })

  it('crée le fichier groups.db dans DATA_DIR', () => {
    const dir = mkdtempSync(join(tmpdir(), 'etp-groupsdb-'))
    const fileDb = openGroupsDb(dir)
    saveGroupState(fileDb, 1, { count: 1, map: { 7: 1 } })
    fileDb.close()

    expect(existsSync(join(dir, 'groups.db'))).toBe(true)

    // Réouverture : les données survivent
    const reopened = openGroupsDb(dir)
    expect(readGroupState(reopened, 1).map).toEqual({ 7: 1 })
    reopened.close()
  })
})
