// features/auth/stores/authStore.ts
console.log('unused');
/*import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { setAccessToken } from '../../../../shared/lib/http.ts'
import { authApi } from '../api/authApi'
import type { AuthResponse, LoginPayload, RegisterPayload, Role, User } from '../types'

export const useAuthStore = defineStore('auth', () => {
  // ---------- state ----------
  const user = ref<User | null>(null)
  // true once the "am I still logged in?" check on app start has finished
  const ready = ref(false)

  // ---------- getters ----------
  const isLoggedIn = computed(() => !!user.value)
  const hasRole = (...roles: Role[]) => !!user.value && roles.includes(user.value.role)

  // ---------- internal helpers ----------
  function setSession(data: AuthResponse) {
    setAccessToken(data.accessToken) // token goes to the axios instance (memory only)
    user.value = data.user // user + role stay in the store
  }

  function clearSession() {
    setAccessToken(null)
    user.value = null
  }

  // ---------- actions ----------
  // Runs once on app start (called by the router guard). The httpOnly refresh
  // cookie restores the session after a page reload. Safe to call repeatedly.
  let initPromise: Promise<void> | null = null
  function init() {
    initPromise ??= authApi
      .refresh()
      .then(setSession)
      .catch(clearSession) // no cookie / expired -> simply logged out
      .finally(() => {
        ready.value = true
      })
    return initPromise
  }

  async function login(payload: LoginPayload) {
    setSession(await authApi.login(payload))
  }

  async function register(payload: RegisterPayload) {
    setSession(await authApi.register(payload))
  }

  async function logout() {
    try {
      await authApi.logout()
    } finally {
      clearSession() // log out locally even if the request fails
    }
  }

  return { user, ready, isLoggedIn, hasRole, init, login, register, logout, clearSession }
})*/