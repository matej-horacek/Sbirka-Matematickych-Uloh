export type Role = 'user' | 'teacher' | 'admin' // adjust to your privilege levels

export interface User {
  id: string
  email: string
  name: string
  role: Role
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload extends LoginPayload {
  name: string
}

export interface AuthResponse {
  accessToken: string
  user: User
}