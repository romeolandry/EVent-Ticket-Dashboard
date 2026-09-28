import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatsModal from '@/components/StatsModal.vue'
import { createTestI18n } from '@/test/i18n'
import type { Attendee } from '@/types/tickets'

function mountModal(props: { attendees: Attendee[] }) {
  return mount(StatsModal, { props, global: { plugins: [createTestI18n()] } })
}

const attendees: Attendee[] = [
  {
    id: 1,
    name: 'Alice',
    email: '',
    ticket: '',
    checkedIn: false,
    fields: { Kinder: '4 (5,5,3,1)', 'Wann kommen Sie an?': 'Freitag (05.06.2026)' },
  },
  {
    id: 2,
    name: 'Bob',
    email: '',
    ticket: '',
    checkedIn: false,
    fields: {
      'Anzahl der mitreisenden Kinder (8-14 Jahr)': 'Zwei',
      'Wann kommen Sie an?': 'Donnerst (04.06.2026)',
    },
  },
]

describe('StatsModal', () => {
  it('affiche le diagramme circulaire du taux de présence', () => {
    const wrapper = mountModal({ attendees })

    // 0 présent sur 2 participants
    expect(wrapper.text()).toContain('Taux de présence')
    expect(wrapper.find('.pie-label').text()).toBe('0%')
    expect(wrapper.find('.pie-value').attributes('stroke-dasharray')).toBe('0 100')
    expect(wrapper.text()).toContain('2 absents')
  })

  it('met à jour le pourcentage selon les check-ins', () => {
    const wrapper = mountModal({
      attendees: [attendees[0]!, { ...attendees[1]!, checkedIn: true }],
    })

    expect(wrapper.find('.pie-label').text()).toBe('50%')
    expect(wrapper.find('.pie-value').attributes('stroke-dasharray')).toBe('50 50')
    expect(wrapper.text()).toContain('1 présent')
    expect(wrapper.text()).toContain('1 absent')
  })

  it('affiche les enfants par âge et le total', () => {
    const wrapper = mountModal({ attendees })
    const section = wrapper.text()

    expect(section).toContain('Enfants par âge')
    expect(wrapper.find('.total').text()).toContain('6')
    const rows = wrapper.findAll('.bar-row')
    expect(section).toContain('Âge inconnu')
    expect(rows.length).toBeGreaterThanOrEqual(4)
  })

  it('affiche les statistiques d’arrivée', () => {
    const wrapper = mountModal({ attendees })

    expect(wrapper.text()).toContain('Freitag (05.06.2026)')
    expect(wrapper.text()).toContain('Donnerst (04.06.2026)')
  })

  it('émet "close" au clic sur le bouton de fermeture', async () => {
    const wrapper = mountModal({ attendees })

    await wrapper.find('button.close').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('émet "close" au clic sur le fond', async () => {
    const wrapper = mountModal({ attendees })

    await wrapper.find('.overlay').trigger('click.self')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
