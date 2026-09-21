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
