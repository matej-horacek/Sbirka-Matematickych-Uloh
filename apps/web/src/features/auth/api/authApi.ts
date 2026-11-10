import { http } from '../../../../shared/api/http'
import type { CurrentUser, LoginPayload, RegisterPayload } from '../types'

// The cookies are set and cleared by the API; these calls only carry the JSON.
// Refreshing happens by itself: the axios interceptor does it on a 401 (shared/lib/http.ts).
// `refresh` below is only for trying the endpoint by hand on the account page.
export const authApi = {
  refresh: () => http<CurrentUser>('/auth/refresh', { method: 'POST' }),

  register: (payload: RegisterPayload) =>
    http<CurrentUser>('/auth/register', { method: 'POST', body: payload }),

  login: (payload: LoginPayload) =>
    http<CurrentUser>('/auth/login', { method: 'POST', body: payload }),

  /** Who the access cookie belongs to; rejects with ApiError(401) when nobody is logged in. */
  me: () => http<CurrentUser>('/auth/me'),

  logout: () => http<void>('/auth/logout', { method: 'POST' }),
}
