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
    if (!raw) return { count: DEFAULT_GROUP_COUNT, map: {}, excludeEmails: [] }
    const parsed = JSON.parse(raw) as Partial<GroupState>
    return {
      count: typeof parsed.count === 'number' && parsed.count > 0 ? parsed.count : DEFAULT_GROUP_COUNT,
      map: parsed.map && typeof parsed.map === 'object' ? parsed.map : {},
      excludeEmails: Array.isArray(parsed.excludeEmails)
        ? parsed.excludeEmails.filter((e): e is string => typeof e === 'string')
        : [],
    }
  } catch {
    return { count: DEFAULT_GROUP_COUNT, map: {}, excludeEmails: [] }
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
  /** Emails exclus de la répartition automatique (par événement). */
  const excludedEmails = ref<string[]>([])

  /** Écritures serveur sérialisées : évite les écrasements croisés. */
  let serverSaveQueue: Promise<void> = Promise.resolve()

  function persistGroups() {
    const eventId = selectedEventId.value
    if (eventId == null) return
    const state: GroupState = {
      count: groupCount.value,
      map: groupMap.value,
      excludeEmails: excludedEmails.value,
    }
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
      excludedEmails.value = saved.excludeEmails ?? []
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

  function isReservedGroup(group: number): boolean {
    return group === EXCLUDED_GROUP && groupCount.value > 1 && attendees.value.some(isExcluded)
  }

  /**
   * Assignation manuelle. Retourne false (sans rien changer) quand la règle
   * du groupe réservé serait violée : le groupe 1 à un non-exclus quand la
   * réservation est active, ou un autre groupe que 1 à un exclu.
   */
  function setGroup(attendeeId: number, group: number | null): boolean {
    const attendee = attendees.value.find((a) => a.id === attendeeId)
    if (group != null && attendee) {
      if (isExcluded(attendee) && group !== EXCLUDED_GROUP) return false
      if (!isExcluded(attendee) && isReservedGroup(group)) return false
    }
    const next = { ...groupMap.value }
    if (group == null) delete next[attendeeId]
    else next[attendeeId] = group
    groupMap.value = next
    persistGroups()
    return true
  }

  function setGroupCount(count: number) {
    groupCount.value = Math.max(1, Math.floor(count))
    for (const [id, group] of Object.entries(groupMap.value)) {
      if (group > groupCount.value) delete groupMap.value[Number(id)]
    }
    persistGroups()
  }

  function isExcluded(attendee: Attendee): boolean {
    return excludedEmails.value.includes(attendee.email.trim().toLowerCase())
  }

  /** Groupe réservé aux emails exclus (par défaut). */
  const EXCLUDED_GROUP = 1

  /**
   * Ajoute un email à la liste d'exclusion : le groupe 1 lui est réservé et
   * assigné immédiatement aux participants correspondants.
   * Retourne false si l'email est vide, invalide ou déjà présent.
   */
  function addGroupExclusion(email: string): boolean {
    const normalized = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) return false
    if (excludedEmails.value.includes(normalized)) return false
    excludedEmails.value = [...excludedEmails.value, normalized]
    const next = { ...groupMap.value }
    for (const attendee of attendees.value) {
      if (attendee.email.trim().toLowerCase() === normalized) {
        next[attendee.id] = EXCLUDED_GROUP
      }
    }
    groupMap.value = next
    persistGroups()
    return true
  }

  function removeGroupExclusion(email: string) {
    const normalized = email.trim().toLowerCase()
    excludedEmails.value = excludedEmails.value.filter((e) => e !== normalized)
    // Libère le siège réservé (groupe 1) — une assignation manuelle autre
    // que le groupe réservé est respectée.
    const next = { ...groupMap.value }
    for (const attendee of attendees.value) {
      if (attendee.email.trim().toLowerCase() === normalized && next[attendee.id] === EXCLUDED_GROUP) {
        delete next[attendee.id]
      }
    }
    groupMap.value = next
    persistGroups()
  }

  /**
   * Répartit les participants sur les groupes : les assignations existantes
   * sont conservées (un participant garde son groupe d'une session à l'autre),
   * seuls les participants sans groupe sont répartis, en comblant à chaque
   * fois le groupe le moins rempli.
   * Dès qu'au moins un participant présent est exclu, le groupe 1 est
   * **réservé aux exclus** (ils le reçoivent par défaut) et les autres sont
   * répartis sur les groupes 2..N ; un non-exclus encore en groupe 1 est
   * déplacé. Sans exclu présent, les groupes 1..N sont utilisés.
   */
  function autoAssignGroups() {
    const anyExcluded = attendees.value.some(isExcluded)
    const reserved = anyExcluded && groupCount.value > 1
    const firstRegularGroup = reserved ? EXCLUDED_GROUP + 1 : EXCLUDED_GROUP

    const map: Record<number, number> = {}
    const sizes = Array.from({ length: groupCount.value }, () => 0)
    for (const attendee of attendees.value) {
      if (isExcluded(attendee)) {
        map[attendee.id] = EXCLUDED_GROUP
        sizes[EXCLUDED_GROUP - 1] = (sizes[EXCLUDED_GROUP - 1] ?? 0) + 1
        continue
      }
      const existing = groupMap.value[attendee.id]
      if (
        existing != null &&
        existing >= firstRegularGroup &&
        existing <= groupCount.value
      ) {
        map[attendee.id] = existing
        sizes[existing - 1] = (sizes[existing - 1] ?? 0) + 1
      }
    }
    for (const attendee of attendees.value) {
      if (map[attendee.id] != null) continue
      let min = firstRegularGroup - 1
      for (let i = firstRegularGroup; i < sizes.length; i++) {
        if ((sizes[i] ?? 0) < (sizes[min] ?? 0)) min = i
      }
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
    excludedEmails,
    loadAttendees,
    updateCheckIn,
    setGroup,
    setGroupCount,
    addGroupExclusion,
    removeGroupExclusion,
    autoAssignGroups,
  }
})
