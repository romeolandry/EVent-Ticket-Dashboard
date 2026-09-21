import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EventSelector from '@/components/EventSelector.vue'
import { createTestI18n } from '@/test/i18n'
import type { WpEvent } from '@/types/tickets'

function mountSelector(props: { events: WpEvent[]; loading?: boolean }) {
  return mount(EventSelector, { props, global: { plugins: [createTestI18n()] } })
}

const events: WpEvent[] = [
  { id: 1, title: 'Concert A' },
  { id: 2, title: 'Conférence B' },
]

describe('EventSelector', () => {
  it('affiche les événements passés en props', () => {
    const wrapper = mountSelector({ events })
    const options = wrapper.findAll('option')

    expect(options).toHaveLength(3) // option placeholder + 2 événements
    expect(wrapper.text()).toContain('Concert A')
    expect(wrapper.text()).toContain('Conférence B')
  })

  it('émet "select" avec l’identifiant de l’événement choisi', async () => {
    const wrapper = mountSelector({ events })

    await wrapper.find('select').setValue('2')

    expect(wrapper.emitted('select')).toEqual([[2]])
  })

  it('désactive le select pendant le chargement', () => {
    const wrapper = mountSelector({ events, loading: true })

    expect(wrapper.find('select').attributes('disabled')).toBeDefined()
  })
})
