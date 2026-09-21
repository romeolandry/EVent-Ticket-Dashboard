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

  function actionButtons(wrapper: ReturnType<typeof mount>, rowIndex: number) {
    const buttons = wrapper.findAll('tbody tr')[rowIndex]!.findAll('button')
    return [buttons[0]!, buttons[1]!, buttons[2]!] as const
  }

  it('affiche la colonne Actions avec les états selon le check-in', () => {
    const wrapper = mount(AttendeeTable, { props: { attendees } })

    expect(wrapper.findAll('th').map((th) => th.text())).toContain('Actions')

    // Alice : checkée → check-out et Print Badge actifs
    const [checkIn1, checkOut1, print1] = actionButtons(wrapper, 0)
    expect(checkIn1.attributes('disabled')).toBeDefined()
    expect(checkOut1.attributes('disabled')).toBeUndefined()
    expect(print1.attributes('disabled')).toBeUndefined()

    // Bob : non checké → seul check-in actif, Print Badge inactif
    const [checkIn2, checkOut2, print2] = actionButtons(wrapper, 1)
    expect(checkIn2.attributes('disabled')).toBeUndefined()
    expect(checkOut2.attributes('disabled')).toBeDefined()
    expect(print2.attributes('disabled')).toBeDefined()
  })

  it('émet checkIn / checkOut / print avec le bon participant', async () => {
    const wrapper = mount(AttendeeTable, { props: { attendees } })
    const [, checkOut1, print1] = actionButtons(wrapper, 0)
    const [checkIn2] = actionButtons(wrapper, 1)

    await checkIn2.trigger('click')
    expect(wrapper.emitted('checkIn')).toEqual([[11]])

    await checkOut1.trigger('click')
    expect(wrapper.emitted('checkOut')).toEqual([[10]])

    await print1.trigger('click')
    expect(wrapper.emitted('print')?.[0]?.[0]).toMatchObject({ id: 10 })
  })
})
