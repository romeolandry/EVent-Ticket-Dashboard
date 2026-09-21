import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Attendee } from '@/types/tickets'
import { fetchAttendees, setCheckedIn } from '@/services/wpApi'

interface GroupState {
  count: number
  /** attendeeId → numéro de groupe */
  map: Record<number, number>
}

const DEFAULT_GROUP_COUNT = 4

function groupsStorageKey(eventId: number): string {
  return `etp-groups:${eventId}`
}

function loadGroups(eventId: number, storage: Storage = localStorage): GroupState {
  try {
    const raw = storage.getItem(groupsStorageKey(eventId))
    if (!raw) return { count: DEFAULT_GROUP_COUNT, map: {} }
    const parsed = JSON.parse(raw) as Partial<GroupState>
    return {
      count: typeof parsed.count === 'number' && parsed.count > 0 ? parsed.count : DEFAULT_GROUP_COUNT,
      map: parsed.map && typeof parsed.map === 'object' ? parsed.map : {},
    }
  } catch {
    return { count: DEFAULT_GROUP_COUNT, map: {} }
  }
}

export const useAttendeesStore = defineStore('attendees', () => {
  const attendees = ref<Attendee[]>([])
  const selectedEventId = ref<number | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const pendingActionId = ref<number | null>(null)

  /** Groupes de travail : attendeeId → numéro de groupe (persistés par événement). */
  const groupMap = ref<Record<number, number>>({})
  const groupCount = ref(DEFAULT_GROUP_COUNT)

  function persistGroups() {
    if (selectedEventId.value == null) return
    localStorage.setItem(
      groupsStorageKey(selectedEventId.value),
      JSON.stringify({ count: groupCount.value, map: groupMap.value } satisfies GroupState),
    )
  }

  async function loadAttendees(eventId: number) {
    selectedEventId.value = eventId
    isLoading.value = true
    error.value = null
    try {
      attendees.value = await fetchAttendees(eventId)
      const saved = loadGroups(eventId)
      groupCount.value = saved.count
      groupMap.value = saved.map
    } catch (e) {
      attendees.value = []
      groupMap.value = {}
      error.value = e instanceof Error ? e.message : 'Erreur inconnue'
    } finally {
      isLoading.value = false
    }
  }

  async function updateCheckIn(attendeeId: number, checked: boolean) {
    pendingActionId.value = attendeeId
    error.value = null
    try {
      await setCheckedIn(attendeeId, checked)
      attendees.value = attendees.value.map((a) =>
        a.id === attendeeId ? { ...a, checkedIn: checked } : a,
      )
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur inconnue'
    } finally {
      pendingActionId.value = null
    }
  }

  function setGroup(attendeeId: number, group: number | null) {
    const next = { ...groupMap.value }
    if (group == null) delete next[attendeeId]
    else next[attendeeId] = group
    groupMap.value = next
    persistGroups()
  }

  function setGroupCount(count: number) {
    groupCount.value = Math.max(1, Math.floor(count))
    for (const [id, group] of Object.entries(groupMap.value)) {
      if (group > groupCount.value) delete groupMap.value[Number(id)]
    }
    persistGroups()
  }

  /** Répartit tous les participants équitablement (tourniquet) sur les groupes. */
  function autoAssignGroups() {
    const map: Record<number, number> = {}
    attendees.value.forEach((attendee, index) => {
      map[attendee.id] = (index % groupCount.value) + 1
    })
    groupMap.value = map
    persistGroups()
  }

  return {
    attendees,
    selectedEventId,
    isLoading,
    error,
    pendingActionId,
    groupMap,
    groupCount,
    loadAttendees,
    updateCheckIn,
    setGroup,
    setGroupCount,
    autoAssignGroups,
  }
})
