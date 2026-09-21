import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAttendeesStore } from '@/stores/attendees'
import { setCheckedIn } from '@/services/wpApi'
import type { Attendee } from '@/types/tickets'

vi.mock('@/services/wpApi', () => ({
  fetchAttendees: vi.fn<(eventId: number) => Promise<Attendee[]>>(async () => [
    { id: 1, name: 'Alice', email: '', ticket: '', checkedIn: false, fields: {} },
  ]),
  setCheckedIn: vi.fn<(id: number, checked: boolean) => Promise<void>>(async () => undefined),
}))

const mockedSetCheckedIn = vi.mocked(setCheckedIn)

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
