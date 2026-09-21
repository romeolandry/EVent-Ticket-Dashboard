import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AttendeeTable from '@/components/AttendeeTable.vue'
import type { Attendee } from '@/types/tickets'

const attendees: Attendee[] = [
  {
    id: 10,
    name: 'Alice Dupont',
    email: 'alice@example.com',
    ticket: 'VIP',
    checkedIn: true,
    fields: { entreprise: 'Acme', regime: 'Végétarien' },
  },
  {
    id: 11,
    name: 'Bob Martin',
    email: 'bob@example.com',
    ticket: 'Standard',
    checkedIn: false,
    fields: { entreprise: 'Globex' },
  },
]

describe('AttendeeTable', () => {
  it('affiche les participants avec leurs colonnes de base', () => {
    const wrapper = mount(AttendeeTable, { props: { attendees } })

    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.text()).toContain('Alice Dupont')
    expect(wrapper.text()).toContain('VIP')
  })

  it('génère dynamiquement les colonnes des champs personnalisés', () => {
    const wrapper = mount(AttendeeTable, { props: { attendees } })
    const headers = wrapper.findAll('th').map((th) => th.text())

    expect(headers).toContain('entreprise')
    expect(headers).toContain('regime')
    expect(wrapper.text()).toContain('Végétarien')
  })

  it('affiche un message quand il n’y a aucun participant', () => {
    const wrapper = mount(AttendeeTable, { props: { attendees: [] } })

    expect(wrapper.text()).toContain('Aucun participant')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('affiche un indicateur de chargement', () => {
    const wrapper = mount(AttendeeTable, { props: { attendees: [], loading: true } })

    expect(wrapper.text()).toContain('Chargement des participants')
  })
})
