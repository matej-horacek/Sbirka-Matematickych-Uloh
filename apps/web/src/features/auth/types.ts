// Shapes of the auth endpoints (openapi.yaml: CurrentUser, LoginRequest, RegisterRequest).

/** Role as the API returns it. For the UI only (which buttons to show): the server checks permissions itself. */
export type Role =
  | 'REGISTERED_TEACHER'
  | 'VERIFIED_TEACHER'
  | 'TRUSTED_TEACHER'
  | 'ADMIN'
  | 'SUPERADMIN'

/** The logged-in user (response of register, login, refresh and /auth/me). */
export interface CurrentUser {
  id: string
  username: string
  displayName: string
  email: string
  role: Role
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload extends LoginPayload {
  username: string
  displayName?: string | null
}
