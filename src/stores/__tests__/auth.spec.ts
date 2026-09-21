import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

vi.mock('@/services/authApi', () => ({
  login: vi.fn<(email: string) => Promise<{ token: string; email: string; isSuperuser: boolean }>>(
    async (email) => ({
      token: 'tok-123',
      email: email.toLowerCase(),
      isSuperuser: email.toLowerCase().startsWith('admin'),
    }),
  ),
  logout: vi.fn<(token: string) => Promise<void>>(async () => undefined),
}))

describe('stores/auth', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('login stocke token, email et flag superuser', async () => {
    const store = useAuthStore()

    await store.login('Admin@Wach-Auf.com')

    expect(store.token).toBe('tok-123')
    expect(store.email).toBe('admin@wach-auf.com')
    expect(store.isSuperuser).toBe(true)
    expect(store.isLoggedIn).toBe(true)
    expect(localStorage.getItem('etp-auth-token')).toBe('tok-123')
  })

  it('un email refusé propage l’erreur sans ouvrir de session', async () => {
    const { login } = await import('@/services/authApi')
    vi.mocked(login).mockRejectedValueOnce(new Error('not_allowed'))
    const store = useAuthStore()

    await expect(store.login('x@y.zz')).rejects.toThrow('not_allowed')
    expect(store.isLoggedIn).toBe(false)
  })

  it('logout vide la session et le stockage', async () => {
    const store = useAuthStore()
    await store.login('staff@wach-auf.com')

    await store.logout()

    expect(store.isLoggedIn).toBe(false)
    expect(store.email).toBe('')
    expect(localStorage.getItem('etp-auth-token')).toBeNull()
  })

  it('restaure la session depuis localStorage', () => {
    localStorage.setItem('etp-auth-token', 'tok-abc')
    localStorage.setItem('etp-auth-email', 'staff@wach-auf.com')
    localStorage.setItem('etp-auth-superuser', '0')

    const store = useAuthStore()

    expect(store.isLoggedIn).toBe(true)
    expect(store.email).toBe('staff@wach-auf.com')
    expect(store.isSuperuser).toBe(false)
  })
})
