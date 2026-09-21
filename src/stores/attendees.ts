import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Attendee } from '@/types/tickets'
import { fetchAttendees } from '@/services/wpApi'

export const useAttendeesStore = defineStore('attendees', () => {
  const attendees = ref<Attendee[]>([])
  const selectedEventId = ref<number | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function loadAttendees(eventId: number) {
    selectedEventId.value = eventId
    isLoading.value = true
    error.value = null
    try {
      attendees.value = await fetchAttendees(eventId)
    } catch (e) {
      attendees.value = []
      error.value = e instanceof Error ? e.message : 'Erreur inconnue'
    } finally {
      isLoading.value = false
    }
  }

  return { attendees, selectedEventId, isLoading, error, loadAttendees }
})
