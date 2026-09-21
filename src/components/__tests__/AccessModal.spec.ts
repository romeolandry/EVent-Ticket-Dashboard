import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AccessModal from '@/components/AccessModal.vue'
import { createTestI18n } from '@/test/i18n'

const fetchListMock = vi.fn<(token: string) => Promise<{ emails: string[] }>>()
const saveListMock =
  vi.fn<(token: string, emails: string[]) => Promise<{ emails: string[] }>>()

vi.mock('@/services/authApi', () => ({
  fetchAccessList: (token: string) => fetchListMock(token),
  saveAccessList: (token: string, emails: string[]) => saveListMock(token, emails),
}))

function mountModal() {
  return mount(AccessModal, {
    props: { token: 'tok-1' },
    global: { plugins: [createTestI18n()] },
  })
}

describe('AccessModal', () => {
  beforeEach(() => {
    fetchListMock.mockReset()
    saveListMock.mockReset()
  })

  it('charge et affiche la liste des emails autorisés', async () => {
    fetchListMock.mockResolvedValueOnce({ emails: ['staff@wach-auf.com'] })
    const wrapper = mountModal()
    await flushPromises()

    expect(fetchListMock).toHaveBeenCalledWith('tok-1')
    expect(wrapper.text()).toContain('staff@wach-auf.com')
  })

  it('ajoute, retire et enregistre la liste', async () => {
    fetchListMock.mockResolvedValueOnce({ emails: ['staff@wach-auf.com'] })
    saveListMock.mockImplementation(async (_t, emails) => ({ emails }))
    const wrapper = mountModal()
    await flushPromises()

    await wrapper.find('input[type="email"]').setValue('aide@Wach-Auf.com')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('aide@wach-auf.com')

    await wrapper.find('.btn-remove').trigger('click')
    expect(wrapper.text()).not.toContain('staff@wach-auf.com')

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Enregistrer')!
      .trigger('click')
    await flushPromises()

    expect(saveListMock).toHaveBeenCalledWith('tok-1', ['aide@wach-auf.com'])
    expect(wrapper.text()).toContain('Liste enregistrée')
  })

  it('affiche une erreur si le chargement échoue', async () => {
    fetchListMock.mockRejectedValueOnce(new Error('forbidden'))
    const wrapper = mountModal()
    await flushPromises()

    expect(wrapper.text()).toContain('Impossible de charger la liste')
  })
})
