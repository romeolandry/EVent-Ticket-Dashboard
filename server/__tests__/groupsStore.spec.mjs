import { describe, it, expect } from 'vitest'
import { groupsFileName, sanitizeGroupState } from '../groupsStore.mjs'

describe('server/groupsStore', () => {
  it('groupsFileName valide les ids d’événement', () => {
    expect(groupsFileName(1262)).toBe('groups-1262.json')
    expect(groupsFileName('1298')).toBe('groups-1298.json')
    expect(groupsFileName('toto')).toBeNull()
    expect(groupsFileName('../secret')).toBeNull()
    expect(groupsFileName(0)).toBeNull()
    expect(groupsFileName(-3)).toBeNull()
    expect(groupsFileName(12.5)).toBeNull()
    expect(groupsFileName(null)).toBeNull()
  })

  it('sanitizeGroupState retourne l’état par défaut pour une entrée vide', () => {
    expect(sanitizeGroupState(null)).toEqual({ count: 4, map: {}, excludeEmails: [] })
    expect(sanitizeGroupState(undefined)).toEqual({ count: 4, map: {}, excludeEmails: [] })
    expect(sanitizeGroupState('n’importe quoi')).toEqual({
      count: 4,
      map: {},
      excludeEmails: [],
    })
  })

  it('sanitizeGroupState conserve un état valide', () => {
    expect(sanitizeGroupState({ count: 3, map: { 12: 1, '34': 3 } })).toEqual({
      count: 3,
      map: { 12: 1, 34: 3 },
      excludeEmails: [],
    })
  })

  it('sanitizeGroupState ignore les entrées invalides ou hors limites', () => {
    const state = sanitizeGroupState({
      count: 2,
      map: { 1: 1, 2: 3, abc: 1, 4: 0, 5: 'x', '-6': 2 },
    })
    expect(state).toEqual({ count: 2, map: { 1: 1 }, excludeEmails: [] })
  })

  it('sanitizeGroupState nettoie la liste des emails exclus', () => {
    const state = sanitizeGroupState({
      count: 2,
      map: {},
      excludeEmails: [' Staff@Wach-Auf.com ', 'pas-un-email', 'staff@wach-auf.com', 42],
    })
    expect(state.excludeEmails).toEqual(['staff@wach-auf.com'])
  })

  it('sanitizeGroupState applique le count par défaut si invalide', () => {
    expect(sanitizeGroupState({ count: 0, map: { 1: 4 } }).count).toBe(4)
    expect(sanitizeGroupState({ count: -2 }).count).toBe(4)
    expect(sanitizeGroupState({ count: 'x' }).count).toBe(4)
  })
})
