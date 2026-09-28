import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAttendeesStore } from '@/stores/attendees'
import { setCheckedIn } from '@/services/wpApi'
import { fetchGroups, saveGroups, type GroupState } from '@/services/groupsApi'
import type { Attendee } from '@/types/tickets'

vi.mock('@/services/wpApi', () => ({
  fetchAttendees: vi.fn<(eventId: number) => Promise<Attendee[]>>(async () => [
    { id: 1, name: 'Alice', email: '', ticket: '', checkedIn: false, fields: {} },
    { id: 2, name: 'Bob', email: '', ticket: '', checkedIn: false, fields: {} },
    { id: 3, name: 'Claire', email: '', ticket: '', checkedIn: false, fields: {} },
  ]),
  setCheckedIn: vi.fn<(id: number, checked: boolean) => Promise<void>>(async () => undefined),
}))

vi.mock('@/services/groupsApi', () => ({
  fetchGroups: vi.fn<(eventId: number) => Promise<GroupState | null>>(async () => null),
  saveGroups: vi.fn<(eventId: number, state: GroupState) => Promise<void>>(async () => undefined),
}))

const mockedSetCheckedIn = vi.mocked(setCheckedIn)
// Null = « serveur sans données / injoignable » → repli localStorage
const mockedFetchGroups = vi.mocked(
  fetchGroups as unknown as (eventId: number) => Promise<GroupState | null>,
)
const mockedSaveGroups = vi.mocked(saveGroups)

describe('stores/attendees — check-in', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockedSetCheckedIn.mockClear()
  })

  it('updateCheckIn met à jour l’état local après l’API', async () => {
    const store = useAttendeesStore()
    await store.loadAttendees(1262)

    await store.updateCheckIn(1, true)

    expect(mockedSetCheckedIn).toHaveBeenCalledWith(1, true)
    expect((store.attendees[0] as Attendee).checkedIn).toBe(true)
    expect(store.pendingActionId).toBeNull()

    await store.updateCheckIn(1, false)
    expect(mockedSetCheckedIn).toHaveBeenCalledWith(1, false)
    expect((store.attendees[0] as Attendee).checkedIn).toBe(false)
  })

  it("conserve l'état et expose l'erreur si l'API échoue", async () => {
    mockedSetCheckedIn.mockRejectedValueOnce(new Error('Échec du check-in (403)'))
    const store = useAttendeesStore()
    await store.loadAttendees(1262)

    await store.updateCheckIn(1, true)

    expect((store.attendees[0] as Attendee).checkedIn).toBe(false)
    expect(store.error).toBe('Échec du check-in (403)')
    expect(store.pendingActionId).toBeNull()
  })
})

describe('stores/attendees — groupes de travail', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    mockedFetchGroups.mockClear().mockResolvedValue(null)
    mockedSaveGroups.mockClear()
  })

  it('setGroup assigne et persiste un groupe par événement', async () => {
    const store = useAttendeesStore()
    await store.loadAttendees(1262)

    store.setGroup(1, 2)

    expect(store.groupMap[1]).toBe(2)
    expect(JSON.parse(localStorage.getItem('etp-groups:1262') ?? '{}').map['1']).toBe(2)

    store.setGroup(1, null)
    expect(store.groupMap[1]).toBeUndefined()
  })

  it('autoAssignGroups répartit équitablement (tourniquet)', async () => {
    const store = useAttendeesStore()
    await store.loadAttendees(1262)
    store.setGroupCount(2)

    store.autoAssignGroups()

    expect([store.groupMap[1], store.groupMap[2], store.groupMap[3]]).toEqual([1, 2, 1])
  })

  it('autoAssignGroups conserve les groupes existants et répartit les nouveaux', async () => {
    localStorage.setItem('etp-groups:1262', JSON.stringify({ count: 2, map: { 1: 2 } }))
    const store = useAttendeesStore()
    await store.loadAttendees(1262)

    store.autoAssignGroups()

    // Alice garde son groupe 2 ; Bob et Claire comblent le groupe le moins rempli
    expect(store.groupMap[1]).toBe(2)
    expect(store.groupMap[2]).toBe(1)
    expect(store.groupMap[3]).toBe(1)
  })

  it('autoAssignGroups ignore les assignations des participants absents', async () => {
    localStorage.setItem('etp-groups:1262', JSON.stringify({ count: 2, map: { 99: 1 } }))
    const store = useAttendeesStore()
    await store.loadAttendees(1262)

    store.autoAssignGroups()

    expect(store.groupMap[99]).toBeUndefined()
    expect(Object.keys(store.groupMap)).toHaveLength(3)
  })

  it('setGroup persiste l’assignation manuelle sur le serveur', async () => {
    const store = useAttendeesStore()
    await store.loadAttendees(1262)

    store.setGroup(2, 3)

    await vi.waitFor(() =>
      expect(mockedSaveGroups).toHaveBeenCalledWith(1262, { count: 4, map: { 2: 3 } }),
    )
  })

  it('le serveur fait foi au chargement (partage entre clients)', async () => {
    localStorage.setItem('etp-groups:1262', JSON.stringify({ count: 2, map: { 1: 1 } }))
    mockedFetchGroups.mockResolvedValue({ count: 5, map: { 2: 5 } })
    const store = useAttendeesStore()

    await store.loadAttendees(1262)

    expect(store.groupCount).toBe(5)
    expect(store.groupMap).toEqual({ 2: 5 })
    // Le cache local est mis à jour avec l'état serveur
    expect(JSON.parse(localStorage.getItem('etp-groups:1262') ?? '{}')).toEqual({
      count: 5,
      map: { 2: 5 },
    })
  })

  it('localStorage sert de repli si le serveur est injoignable', async () => {
    localStorage.setItem('etp-groups:1262', JSON.stringify({ count: 3, map: { 7: 1 } }))
    mockedFetchGroups.mockRejectedValue(new Error('réseau coupé'))
    const store = useAttendeesStore()

    await store.loadAttendees(1262)

    expect(store.groupCount).toBe(3)
    expect(store.groupMap[7]).toBe(1)
  })

  it('recharge les groupes sauvegardés au chargement de l’événement', async () => {
    localStorage.setItem('etp-groups:1262', JSON.stringify({ count: 3, map: { 7: 1 } }))
    const store = useAttendeesStore()

    await store.loadAttendees(1262)

    expect(store.groupCount).toBe(3)
    expect(store.groupMap[7]).toBe(1)
  })

  it('setGroupCount purge les assignations au-delà du nouveau nombre', async () => {
    const store = useAttendeesStore()
    await store.loadAttendees(1262)
    store.setGroup(1, 4)

    store.setGroupCount(2)

    expect(store.groupCount).toBe(2)
    expect(store.groupMap[1]).toBeUndefined()
  })
})
