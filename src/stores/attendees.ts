import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Attendee } from '@/types/tickets'
import { fetchAttendees, setCheckedIn } from '@/services/wpApi'
import { fetchGroups, saveGroups, type GroupState } from '@/services/groupsApi'

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

  /**
   * Groupes de travail : attendeeId → numéro de groupe, persistés côté
   * serveur par événement — tous les clients connectés partagent les mêmes
   * assignations. localStorage sert uniquement de cache hors-ligne.
   */
  const groupMap = ref<Record<number, number>>({})
  const groupCount = ref(DEFAULT_GROUP_COUNT)

  /** Écritures serveur sérialisées : évite les écrasements croisés. */
  let serverSaveQueue: Promise<void> = Promise.resolve()

  function persistGroups() {
    const eventId = selectedEventId.value
    if (eventId == null) return
    const state: GroupState = { count: groupCount.value, map: groupMap.value }
    localStorage.setItem(groupsStorageKey(eventId), JSON.stringify(state))
    serverSaveQueue = serverSaveQueue
      .then(() => saveGroups(eventId, state))
      .catch((e) => {
        error.value = e instanceof Error ? e.message : 'Erreur inconnue'
      })
  }

  async function loadAttendees(eventId: number) {
    selectedEventId.value = eventId
    isLoading.value = true
    error.value = null
    try {
      attendees.value = await fetchAttendees(eventId)
      // Le serveur fait foi ; localStorage n'est qu'un repli (hors-ligne).
      const saved = (await fetchGroups(eventId).catch(() => null)) ?? loadGroups(eventId)
      groupCount.value = saved.count
      groupMap.value = saved.map
      localStorage.setItem(groupsStorageKey(eventId), JSON.stringify(saved))
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

  /**
   * Répartit les participants sur les groupes : les assignations existantes
   * sont conservées (un participant garde son groupe d'une session à l'autre),
   * seuls les participants sans groupe sont répartis, en comblant à chaque
   * fois le groupe le moins rempli.
   */
  function autoAssignGroups() {
    const map: Record<number, number> = {}
    const sizes = Array.from({ length: groupCount.value }, () => 0)
    for (const attendee of attendees.value) {
      const existing = groupMap.value[attendee.id]
      if (existing != null && existing >= 1 && existing <= groupCount.value) {
        map[attendee.id] = existing
        sizes[existing - 1] = (sizes[existing - 1] ?? 0) + 1
      }
    }
    for (const attendee of attendees.value) {
      if (map[attendee.id] != null) continue
      let min = 0
      for (let i = 1; i < sizes.length; i++) if ((sizes[i] ?? 0) < (sizes[min] ?? 0)) min = i
      map[attendee.id] = min + 1
      sizes[min] = (sizes[min] ?? 0) + 1
    }
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
