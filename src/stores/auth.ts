import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as authApi from '@/services/authApi'

const TOKEN_KEY = 'etp-auth-token'
const EMAIL_KEY = 'etp-auth-email'
const SUPER_KEY = 'etp-auth-superuser'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY) ?? '')
  const email = ref(localStorage.getItem(EMAIL_KEY) ?? '')
  const isSuperuser = ref(localStorage.getItem(SUPER_KEY) === '1')
  const isLoggedIn = computed(() => token.value !== '')

  async function login(rawEmail: string) {
    const session = await authApi.login(rawEmail)
    token.value = session.token
    email.value = session.email
    isSuperuser.value = session.isSuperuser
    localStorage.setItem(TOKEN_KEY, session.token)
    localStorage.setItem(EMAIL_KEY, session.email)
    localStorage.setItem(SUPER_KEY, session.isSuperuser ? '1' : '0')
  }

  async function logout() {
    if (token.value) await authApi.logout(token.value).catch(() => undefined)
    token.value = ''
    email.value = ''
    isSuperuser.value = false
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(EMAIL_KEY)
    localStorage.removeItem(SUPER_KEY)
  }

  return { token, email, isSuperuser, isLoggedIn, login, logout }
})
