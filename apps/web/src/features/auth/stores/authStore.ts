import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authApi } from '../api/authApi'
import type { CurrentUser, LoginPayload, RegisterPayload } from '../types'

export const useAuthStore = defineStore('auth', () => {
  // ---------- state ----------
  const user = ref<CurrentUser | null>(null)
  // true once the "am I still logged in?" check on app start has finished
  const ready = ref(false)

  // ---------- getters ----------
  const isLoggedIn = computed(() => user.value !== null)

  // ---------- actions ----------
  // Runs once on app start (the router guard awaits it). The httpOnly cookies cannot be read from JS,
  // so after a reload the only way to know who is logged in is to ask the API. If the access cookie
  // has expired, the axios interceptor refreshes the session and retries this call. Safe to call repeatedly.
  let initPromise: Promise<void> | null = null
  function init(): Promise<void> {
    initPromise ??= authApi
      .me()
      .then((me) => {
        user.value = me
      })
      .catch(() => {
        user.value = null // no cookie / expired / blocked: simply logged out
      })
      .finally(() => {
        ready.value = true
      })
    return initPromise
  }

  async function login(payload: LoginPayload) {
    user.value = await authApi.login(payload)
  }

  async function register(payload: RegisterPayload) {
    user.value = await authApi.register(payload)
  }

  async function logout() {
    try {
      await authApi.logout()
    } finally {
      user.value = null // log out locally even if the request fails
    }
  }

  /** Forget the user without calling the API (the session was already lost). */
  function clear() {
    user.value = null
  }

  return { user, ready, isLoggedIn, init, login, register, logout, clear }
})
