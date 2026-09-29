import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AttendeeTable from '@/components/AttendeeTable.vue'
import { createTestI18n } from '@/test/i18n'
import type { Attendee } from '@/types/tickets'

function mountTable(props: {
  attendees: Attendee[]
  loading?: boolean
  groups?: Record<number, number>
  groupCount?: number
  excludedEmails?: string[]
  printingId?: number | null
}) {
  return mount(AttendeeTable, { props, global: { plugins: [createTestI18n()] } })
}

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
    const wrapper = mountTable({ attendees })

    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.text()).toContain('Alice Dupont')
    expect(wrapper.text()).toContain('VIP')
  })

  it('affiche l’icône d’exclusion sur la ligne du participant exclu', () => {
    const wrapper = mountTable({ attendees, excludedEmails: ['BOB@example.com'] })

    const marks = wrapper.findAll('.excluded-mark')
    expect(marks).toHaveLength(1)
    expect(marks[0]!.attributes('aria-label')).toBe('Exclu de la répartition automatique')
    // La marque est sur la ligne de Bob, pas celle d'Alice
    const bobRow = wrapper.findAll('tbody tr').find((r) => r.text().includes('Bob Martin'))
    expect(bobRow!.find('.excluded-mark').exists()).toBe(true)
  })

  it('le groupe 1 n’est pas attribuable manuellement quand il est réservé', () => {
    const wrapper = mountTable({
      attendees,
      groups: { 11: 1 },
      groupCount: 3,
      excludedEmails: ['bob@example.com'],
    })

    // Alice (non exclue) : options 2 et 3 uniquement, jamais 1
    const aliceRow = wrapper.findAll('tbody tr').find((r) => r.text().includes('Alice Dupont'))!
    const aliceOptions = aliceRow.findAll('select.group-select option').map((o) => o.text())
    expect(aliceOptions).toEqual(['—', '2', '3'])

    // Bob (exclu) : pastille fixe « 1 », aucun sélecteur
    const bobRow = wrapper.findAll('tbody tr').find((r) => r.text().includes('Bob Martin'))!
    expect(bobRow.find('select.group-select').exists()).toBe(false)
    expect(bobRow.find('.group-fixed').text()).toBe('1')
  })

  it('le groupe 1 reste attribuable manuellement sans participant exclu', () => {
    const wrapper = mountTable({ attendees, groupCount: 3 })

    const firstRow = wrapper.findAll('tbody tr')[0]!
    const options = firstRow.findAll('select.group-select option').map((o) => o.text())
    expect(options).toEqual(['—', '1', '2', '3'])
  })

  it('aucune icône d’exclusion sans liste d’exclusion', () => {
    const wrapper = mountTable({ attendees })
    expect(wrapper.find('.excluded-mark').exists()).toBe(false)
  })

  it('génère dynamiquement les colonnes des champs personnalisés', () => {
    const wrapper = mountTable({ attendees })
    const headers = wrapper.findAll('th').map((th) => th.text())

    expect(headers).toContain('entreprise')
    expect(headers).toContain('regime')
    expect(wrapper.text()).toContain('Végétarien')
  })

  it('traduit les libellés de champs WordPress connus', () => {
    const wrapper = mountTable({
      attendees: [
        {
          id: 20,
          name: 'Claire',
          email: '',
          ticket: '',
          checkedIn: false,
          fields: { 'Ab wann willst du dabei sein?': 'Freitag, den 2.' },
        },
      ],
    })
    const headers = wrapper.findAll('th').map((th) => th.text())

    expect(headers).toContain('À partir de quand serez-vous présent ?')
    expect(headers).not.toContain('Ab wann willst du dabei sein?')
    expect(wrapper.text()).toContain('Freitag, den 2.')
  })

  it('affiche un message quand il n’y a aucun participant', () => {
    const wrapper = mountTable({ attendees: [] })

    expect(wrapper.text()).toContain('Aucun participant')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('affiche un indicateur de chargement', () => {
    const wrapper = mountTable({ attendees: [], loading: true })

    expect(wrapper.text()).toContain('Chargement des participants')
  })

  function actionButtons(wrapper: ReturnType<typeof mount>, rowIndex: number) {
    const buttons = wrapper.findAll('tbody tr')[rowIndex]!.findAll('button')
    return [buttons[0]!, buttons[1]!, buttons[2]!, buttons[3]!] as const
  }

  it('affiche la colonne Actions avec les états selon le check-in', () => {
    const wrapper = mountTable({ attendees, groups: { 10: 1 } })

    expect(wrapper.findAll('th').map((th) => th.text())).toContain('Actions')

    // Alice : checkée avec groupe → check-out et Print Badge actifs
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

  it('désactive Print Badge sans groupe, même si le participant est checké', () => {
    const wrapper = mountTable({ attendees, groups: {} })

    const [, , printCheckedNoGroup] = actionButtons(wrapper, 0)
    expect(printCheckedNoGroup.attributes('disabled')).toBeDefined()
  })

  it('permet d’assigner un groupe via le select de la colonne Groupe', async () => {
    const wrapper = mountTable({ attendees, groupCount: 3 })

    const select = wrapper.findAll('tbody tr')[1]!.find('select.group-select')
    await select.setValue('2')

    expect(wrapper.emitted('setGroup')).toEqual([[11, 2]])
  })

  it('émet checkIn / checkOut / print avec le bon participant', async () => {
    const wrapper = mountTable({ attendees, groups: { 10: 1 } })
    const [, checkOut1, print1] = actionButtons(wrapper, 0)
    const [checkIn2] = actionButtons(wrapper, 1)

    await checkIn2.trigger('click')
    expect(wrapper.emitted('checkIn')).toEqual([[11]])

    await checkOut1.trigger('click')
    expect(wrapper.emitted('checkOut')).toEqual([[10]])

    await print1.trigger('click')
    expect(wrapper.emitted('print')?.[0]?.[0]).toMatchObject({ id: 10 })

    const [, , , ql1] = actionButtons(wrapper, 0)
    await ql1.trigger('click')
    expect(wrapper.emitted('printQl800')?.[0]?.[0]).toMatchObject({ id: 10 })
  })

  it('désactive le bouton QL-800 pendant une impression en cours', () => {
    const wrapper = mountTable({ attendees, groups: { 10: 1 }, printingId: 10 })

    const [, , , ql1] = actionButtons(wrapper, 0)
    expect(ql1.attributes('disabled')).toBeDefined()

    const [, , , ql2] = actionButtons(wrapper, 1)
    expect(ql2.attributes('disabled')).toBeDefined() // non checké de toute façon
  })
})
