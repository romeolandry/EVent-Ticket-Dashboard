import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LoginView from '@/views/LoginView.vue'
import { createTestI18n } from '@/test/i18n'

const pushMock = vi.fn<(to: unknown) => void>()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

const loginMock =
  vi.fn<(email: string) => Promise<{ token: string; email: string; isSuperuser: boolean }>>()
vi.mock('@/services/authApi', () => ({
  login: (email: string) => loginMock(email),
  logout: vi.fn<(token: string) => Promise<void>>(async () => undefined),
}))

describe('LoginView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    pushMock.mockClear()
    loginMock.mockReset()
  })

  function mountLogin() {
    return mount(LoginView, { global: { plugins: [createTestI18n()] } })
  }

  it('connecte et redirige vers le dashboard', async () => {
    loginMock.mockResolvedValueOnce({
      token: 'tok-1',
      email: 'admin@wach-auf.com',
      isSuperuser: true,
    })
    const wrapper = mountLogin()

    await wrapper.find('input[type="email"]').setValue('admin@wach-auf.com')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(loginMock).toHaveBeenCalledWith('admin@wach-auf.com')
    expect(pushMock).toHaveBeenCalledWith({ name: 'dashboard' })
  })

  it('affiche « non autorisé » si le serveur refuse l’email', async () => {
    loginMock.mockRejectedValueOnce(new Error('not_allowed'))
    const wrapper = mountLogin()

    await wrapper.find('input[type="email"]').setValue('inconnu@x.yz')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('.error').text()).toContain('autorisé')
    expect(pushMock).not.toHaveBeenCalled()
  })
})
