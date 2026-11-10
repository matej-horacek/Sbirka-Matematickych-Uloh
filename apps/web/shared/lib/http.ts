import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios'

// Auth is by httpOnly cookies set by the API (access_token + refresh_token), so there is no token
// to keep here: the browser sends the cookies (withCredentials) and JS cannot read them.

const configuredBaseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

/** API root, always ending in /api/v1 (VITE_API_URL may or may not include it). */
export function getApiBaseUrl(): string {
  if (!configuredBaseUrl) return '/api/v1'
  if (configuredBaseUrl.endsWith('/api/v1')) return configuredBaseUrl
  if (configuredBaseUrl.endsWith('/api')) return `${configuredBaseUrl}/v1`
  return `${configuredBaseUrl}/api/v1`
}

// Registered in main.ts: called when the session cannot be renewed (refresh failed).
let onSessionExpired: (() => void) | null = null

export const setSessionExpiredHandler = (fn: (() => void) | null) => {
  onSessionExpired = fn
}

// The one Axios instance used by the entire application.
export const axiosHttp = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
})

// Backwards compatibility for existing imports.
export const http = axiosHttp

const SAFE_METHODS = new Set(['get', 'head', 'options'])

// CSRF: the API refuses every POST/PATCH/DELETE without this header (403 CSRF_CHECK_FAILED).
// A cross-site form cannot set it, and a cross-site fetch would need a CORS preflight.
axiosHttp.interceptors.request.use((config) => {
  if (!SAFE_METHODS.has((config.method ?? 'get').toLowerCase())) {
    config.headers['X-Requested-With'] = 'XMLHttpRequest'
  }
  return config
})

// These calls never trigger a refresh: a 401 there is an answer, not an expired session.
// (/auth/me is not listed: after a reload its access cookie may be expired while the refresh cookie is not.)
const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']

// One refresh at a time: parallel 401s wait for the same call.
let refreshing: Promise<void> | null = null

function refreshSession(): Promise<void> {
  refreshing ??= axiosHttp
    .post('/auth/refresh')
    .then(() => undefined)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

// 401 -> POST /auth/refresh (rotates both cookies) -> retry the request once.
// If the refresh fails too, the session is over: tell the app (it sends the user to the login page).
axiosHttp.interceptors.response.use(
  (response) => response,

  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined

    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !NO_REFRESH.some((path) => original.url?.startsWith(path))
    ) {
      original._retry = true

      try {
        await refreshSession()
      } catch {
        onSessionExpired?.()
        return Promise.reject(error)
      }

      return axiosHttp(original)
    }

    return Promise.reject(error)
  },
)
