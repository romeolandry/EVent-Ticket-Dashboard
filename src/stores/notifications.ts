import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface AppNotification {
  id: number
  message: string
}

const DEFAULT_TTL_MS = 4000

/** Notifications éphémères affichées en bas d'écran (toasts). */
export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref<AppNotification[]>([])
  let nextId = 0

  function dismiss(id: number) {
    notifications.value = notifications.value.filter((n) => n.id !== id)
  }

  function notify(message: string, ttl = DEFAULT_TTL_MS): number {
    const id = ++nextId
    notifications.value.push({ id, message })
    setTimeout(() => dismiss(id), ttl)
    return id
  }

  return { notifications, notify, dismiss }
})
