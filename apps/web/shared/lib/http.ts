
import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios'

// Access token lives in memory only.
let accessToken: string | null = null

export const setAccessToken = (token: string | null) => {
  accessToken = token
}

// Registered in main.ts.
let onSessionExpired: (() => void) | null = null

export const setSessionExpiredHandler = (fn: () => void) => {
  onSessionExpired = fn
}

// The one Axios instance used by the entire application.
export const axiosHttp = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

// Backwards compatibility for existing imports.
export const http = axiosHttp

// Attach the access token to every request.
axiosHttp.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  return config
})

// Prevent multiple simultaneous refresh requests.
let refreshing: Promise<string> | null = null

function refreshAccessToken(): Promise<string> {
  refreshing ??= axiosHttp
    .post<{ accessToken: string }>('/auth/refresh')
    .then((response) => response.data.accessToken)
    .finally(() => {
      refreshing = null
    })

  return refreshing
}

// Handle expired sessions.
axiosHttp.interceptors.response.use(
  (response) => response,

  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined

    const isAuthCall = original?.url?.startsWith('/auth/')

    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !isAuthCall
    ) {
      original._retry = true

      try {
        const token = await refreshAccessToken()

        setAccessToken(token)

        original.headers.Authorization = `Bearer ${token}`

        return axiosHttp(original)
      } catch {
        onSessionExpired?.()
      }
    }

    return Promise.reject(error)
  },
)
