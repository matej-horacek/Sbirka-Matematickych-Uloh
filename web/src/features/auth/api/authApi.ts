console.log('unused');
// features/auth/api/authApi.ts
/*import { http } from '../../../../shared/lib/http'
import type { AuthResponse, LoginPayload, RegisterPayload } from '../types'

export const authApi = {
  login: (payload: LoginPayload) =>
    http.post<AuthResponse>('/auth/login', payload).then((r) => r.data),
  register: (payload: RegisterPayload) =>
    http.post<AuthResponse>('/auth/register', payload).then((r) => r.data),
  refresh: () => http.post<AuthResponse>('/auth/refresh').then((r) => r.data),
  logout: () => http.post('/auth/logout'),
}*/