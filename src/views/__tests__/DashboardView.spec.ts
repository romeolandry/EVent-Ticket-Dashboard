import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DashboardView from '@/views/DashboardView.vue'
import { useAttendeesStore } from '@/stores/attendees'
import { createTestI18n } from '@/test/i18n'
import type { Attendee } from '@/types/tickets'

function mountView() {
  return mount(DashboardView, { global: { plugins: [createTestI18n()] } })
}

vi.mock('@/services/wpApi', () => ({
  fetchEvents: vi.fn<() => Promise<never[]>>(async () => []),
  fetchAttendees: vi.fn<() => Promise<never[]>>(async () => []),
}))

function makeAttendee(id: number, name: string): Attendee {
  return { id, name, email: '', ticket: 'Standard', checkedIn: false, fields: {} }
}

describe('DashboardView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('filtre le tableau par nom (insensible à la casse)', async () => {
    const wrapper = mountView()
    const store = useAttendeesStore()
    store.attendees = [makeAttendee(1, 'Alice Dupont'), makeAttendee(2, 'Bob Martin')]
    store.selectedEventId = 1262
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('tbody tr')).toHaveLength(2)

    await wrapper.find('input[type="search"]').setValue('alice')

    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.text()).toContain('Alice Dupont')
    expect(wrapper.text()).not.toContain('Bob Martin')
    expect(wrapper.text()).toContain('1 / 2 participants')
  })

  it('affiche tous les participants quand le filtre est vide', async () => {
    const wrapper = mountView()
    const store = useAttendeesStore()
    store.attendees = [makeAttendee(1, 'Alice Dupont'), makeAttendee(2, 'Bob Martin')]
    store.selectedEventId = 1262
    await wrapper.vm.$nextTick()

    const input = wrapper.find('input[type="search"]')
    await input.setValue('bob')
    await input.setValue(' ')

    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
  })

  function attendeeWithArrival(id: number, name: string, day: string): Attendee {
    return { ...makeAttendee(id, name), fields: { 'Ab wann willst du dabei sein?': day } }
  }

  it('filtre par jour d’arrivée (« Ab wann willst du dabei sein? »)', async () => {
    const wrapper = mountView()
    const store = useAttendeesStore()
    store.attendees = [
      attendeeWithArrival(1, 'Alice', 'Freitag, den 2.'),
      attendeeWithArrival(2, 'Bob', 'Samstag, den 3.'),
    ]
    store.selectedEventId = 1262
    await wrapper.vm.$nextTick()

    const select = wrapper.find('select.filter-select')
    expect(select.exists()).toBe(true)
    const options = select.findAll('option').map((o) => o.text())
    expect(options).toContain('Freitag, den 2.')
    expect(options).toContain('Samstag, den 3.')

    await select.setValue('Freitag, den 2.')

    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).not.toContain('Bob')
  })

  it('le bouton d’export CSV télécharge la liste complète', async () => {
    const createObjectURL = vi.fn<() => string>(() => 'blob:mock-url')
    const revokeObjectURL = vi.fn<() => void>()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    const wrapper = mountView()
    const store = useAttendeesStore()
    store.attendees = [attendeeWithArrival(1, 'Alice', 'Freitag, den 2.')]
    store.selectedEventId = 1262
    await wrapper.vm.$nextTick()

    const exportButton = wrapper
      .findAll('button')
      .find((b) => b.text() === 'Exporter en CSV')
    expect(exportButton).toBeDefined()
    await exportButton!.trigger('click')

    expect(createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')

    clickSpy.mockRestore()
  })

  it('filtre par groupe de travail', async () => {
    const wrapper = mountView()
    const store = useAttendeesStore()
    store.attendees = [makeAttendee(1, 'Alice Dupont'), makeAttendee(2, 'Bob Martin')]
    store.groupMap = { 1: 1, 2: 2 }
    store.groupCount = 2
    store.selectedEventId = 1262
    await wrapper.vm.$nextTick()

    const select = wrapper.find('select[aria-label="Filtrer par groupe"]')
    expect(select.exists()).toBe(true)

    await select.setValue('1')

    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.text()).toContain('Alice Dupont')
    expect(wrapper.text()).not.toContain('Bob Martin')
  })

  it('filtre par statut de check-in', async () => {
    const wrapper = mountView()
    const store = useAttendeesStore()
    store.attendees = [
      { ...makeAttendee(1, 'Alice Dupont'), checkedIn: true },
      makeAttendee(2, 'Bob Martin'),
    ]
    store.selectedEventId = 1262
    await wrapper.vm.$nextTick()

    const select = wrapper.find('select[aria-label="Filtrer par présence"]')
    expect(select.exists()).toBe(true)

    await select.setValue('yes')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.text()).toContain('Alice Dupont')
    expect(wrapper.text()).not.toContain('Bob Martin')

    await select.setValue('no')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.text()).toContain('Bob Martin')
    expect(wrapper.text()).not.toContain('Alice Dupont')

    await select.setValue('')
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
  })

  it('pagine la liste par 25 participants', async () => {
    const wrapper = mountView()
    const store = useAttendeesStore()
    store.attendees = Array.from({ length: 30 }, (_, i) => makeAttendee(i + 1, `Personne ${i + 1}`))
    store.selectedEventId = 1262
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('tbody tr')).toHaveLength(25)
    expect(wrapper.text()).toContain('Page 1 / 2 — 30 participants')

    const nextButton = wrapper.findAll('button').find((b) => b.text() === 'Suivant')
    expect(nextButton).toBeDefined()
    await nextButton!.trigger('click')

    expect(wrapper.findAll('tbody tr')).toHaveLength(5)
    expect(wrapper.text()).toContain('Page 2 / 2 — 30 participants')

    const prevButton = wrapper.findAll('button').find((b) => b.text() === 'Précédent')
    await prevButton!.trigger('click')
    expect(wrapper.findAll('tbody tr')).toHaveLength(25)
  })

  it("n'affiche pas la pagination sous 25 participants", async () => {
    const wrapper = mountView()
    const store = useAttendeesStore()
    store.attendees = [makeAttendee(1, 'Alice Dupont'), makeAttendee(2, 'Bob Martin')]
    store.selectedEventId = 1262
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('button').find((b) => b.text() === 'Suivant')).toBeUndefined()
    expect(wrapper.text()).not.toContain('Page 1 /')
  })

  it('revient en page 1 quand un filtre change', async () => {
    const wrapper = mountView()
    const store = useAttendeesStore()
    store.attendees = Array.from({ length: 30 }, (_, i) =>
      makeAttendee(i + 1, i === 0 ? 'Zoé Zeule' : `Personne ${i + 1}`),
    )
    store.selectedEventId = 1262
    await wrapper.vm.$nextTick()

    const nextButton = wrapper.findAll('button').find((b) => b.text() === 'Suivant')
    await nextButton!.trigger('click')
    expect(wrapper.text()).toContain('Page 2 / 2')

    await wrapper.find('input[type="search"]').setValue('zoé')

    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.text()).toContain('Zoé Zeule')
    expect(wrapper.text()).not.toContain('Page 2 / 2')
  })

  it('garde les colonnes dynamiques de toutes les pages', async () => {
    const wrapper = mountView()
    const store = useAttendeesStore()
    store.attendees = [
      ...Array.from({ length: 25 }, (_, i) => makeAttendee(i + 1, `Personne ${i + 1}`)),
      { ...makeAttendee(26, 'Alice Champ'), fields: { Allergies: 'Arachides' } },
    ]
    store.selectedEventId = 1262
    await wrapper.vm.$nextTick()

    // Page 1 : la colonne d'un champ présent uniquement en page 2 reste visible
    expect(wrapper.findAll('thead th').map((th) => th.text())).toContain('Allergies')
  })

  it('le bouton Impression ouvre la configuration', async () => {
    const wrapper = mountView()
    const store = useAttendeesStore()
    store.attendees = [makeAttendee(1, 'Alice Dupont')]
    store.selectedEventId = 1262
    await wrapper.vm.$nextTick()

    const button = wrapper.findAll('button').find((b) => b.text() === 'Impression')
    expect(button).toBeDefined()
    await button!.trigger('click')

    expect(wrapper.text()).toContain('Configuration d’impression')
  })
})
