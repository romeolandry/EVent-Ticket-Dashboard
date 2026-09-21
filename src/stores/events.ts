import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { WpEvent } from '@/types/tickets'
import { fetchEvents } from '@/services/wpApi'

export const useEventsStore = defineStore('events', () => {
  const events = ref<WpEvent[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function loadEvents() {
    isLoading.value = true
    error.value = null
    try {
      events.value = await fetchEvents()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur inconnue'
    } finally {
      isLoading.value = false
    }
  }

  return { events, isLoading, error, loadEvents }
})
