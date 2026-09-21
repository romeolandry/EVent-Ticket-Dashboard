import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EventSelector from '@/components/EventSelector.vue'
import type { WpEvent } from '@/types/tickets'

const events: WpEvent[] = [
  { id: 1, title: 'Concert A' },
  { id: 2, title: 'Conférence B' },
]

describe('EventSelector', () => {
  it('affiche les événements passés en props', () => {
    const wrapper = mount(EventSelector, { props: { events } })
    const options = wrapper.findAll('option')

    expect(options).toHaveLength(3) // option placeholder + 2 événements
    expect(wrapper.text()).toContain('Concert A')
    expect(wrapper.text()).toContain('Conférence B')
  })

  it('émet "select" avec l’identifiant de l’événement choisi', async () => {
    const wrapper = mount(EventSelector, { props: { events } })

    await wrapper.find('select').setValue('2')

    expect(wrapper.emitted('select')).toEqual([[2]])
  })

  it('désactive le select pendant le chargement', () => {
    const wrapper = mount(EventSelector, { props: { events, loading: true } })

    expect(wrapper.find('select').attributes('disabled')).toBeDefined()
  })
})
