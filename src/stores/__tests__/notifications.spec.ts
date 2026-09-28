import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useNotificationsStore } from '@/stores/notifications'

describe('stores/notifications', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('notify ajoute une notification puis la retire après le délai', () => {
    const store = useNotificationsStore()

    store.notify('Alice Dupont → groupe 2')
    expect(store.notifications.map((n) => n.message)).toEqual(['Alice Dupont → groupe 2'])

    vi.advanceTimersByTime(4001)
    expect(store.notifications).toHaveLength(0)
  })

  it('dismiss retire immédiatement une notification', () => {
    const store = useNotificationsStore()

    const id = store.notify('groupe retiré', 60_000)
    store.dismiss(id)

    expect(store.notifications).toHaveLength(0)
    vi.advanceTimersByTime(60_000)
    expect(store.notifications).toHaveLength(0)
  })

  it('empile plusieurs notifications indépendantes', () => {
    const store = useNotificationsStore()

    store.notify('Alice → groupe 1', 60_000)
    store.notify('Bob → groupe 2', 60_000)

    expect(store.notifications).toHaveLength(2)
    expect(store.notifications.map((n) => n.id)[0]).not.toBe(store.notifications[1]!.id)
  })
})
