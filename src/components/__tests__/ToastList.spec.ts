import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ToastList from '@/components/ToastList.vue'
import { useNotificationsStore } from '@/stores/notifications'
import { createTestI18n } from '@/test/i18n'

function mountToasts() {
  return mount(ToastList, { global: { plugins: [createTestI18n()] } })
}

describe('ToastList', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('affiche les notifications et permet de les fermer', async () => {
    const wrapper = mountToasts()
    const store = useNotificationsStore()
    store.notify('Bob Martin → groupe 1', 60_000)
    store.notify('Alice Dupont → groupe 2', 60_000)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Bob Martin → groupe 1')
    expect(wrapper.text()).toContain('Alice Dupont → groupe 2')
    expect(wrapper.findAll('.toast')).toHaveLength(2)

    await wrapper.findAll('button.dismiss')[0]!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).not.toContain('Bob Martin')
    expect(store.notifications).toHaveLength(1)
  })

  it('expose la région aria-live pour les lecteurs d’écran', () => {
    const wrapper = mountToasts()
    expect(wrapper.find('[role="status"][aria-live="polite"]').exists()).toBe(true)
  })
})
