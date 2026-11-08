
import axios from 'axios'
import { axiosHttp } from '../lib/http'

export type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'TRUST_TOO_LOW'
  | 'NOT_FOUND'
  | 'LOCK_MISMATCH'
  | 'SET_PARENT_HAS_RESULT'
  | 'LICENSE_REQUIRED'
  | 'NOT_A_SET'
  | 'SET_CHILD_NOT_PUBLISHABLE'
  | 'IS_SET_CHILD'
  | 'CANNOT_ADD_TO_SET'
  | 'NO_UPDATE_AVAILABLE'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_BLOCKED'
  | 'EMAIL_TAKEN'
  | 'USERNAME_TAKEN'
  | 'CSRF_CHECK_FAILED'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown
  readonly code?: ApiErrorCode | string
  readonly requestId?: string

  constructor(status: number, message: string, body?: unknown) {
    super(message)

    this.name = 'ApiError'
    this.status = status
    this.body = body

    if (isRecord(body)) {
      if (typeof body.code === 'string') {
        this.code = body.code
      }

      if (typeof body.requestId === 'string') {
        this.requestId = body.requestId
      }
    }
  }
}

function messageFromBody(body: unknown, status: number): string {
  if (isRecord(body)) {
    // RFC 9457 backend response.
    if (typeof body.detail === 'string' && body.detail.length > 0) {
      return body.detail
    }

    if (typeof body.title === 'string' && body.title.length > 0) {
      return body.title
    }

    // Compatibility with NestJS validation responses.
    if (typeof body.message === 'string') {
      return body.message
    }

    if (Array.isArray(body.message)) {
      return body.message.join(' ')
    }
  }

  return `Požadavek selhal (${status}).`
}

/**
 * Shared JSON client for all feature APIs.
 * Uses the application's configured Axios instance.
 */
export async function http<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  try {
    const response = await axiosHttp.request<T>({
      url: path.startsWith('/')
        ? path
        : `/${path}`,

      method: options.method ?? 'GET',

      data: options.body,

      headers: {
        Accept: 'application/json, application/problem+json',

        ...(options.body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),

        ...options.headers,
      },
    })

    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 0
      const body: unknown = error.response?.data

      if (status === 0) {
        throw new ApiError(
          0,
          'Server není dostupný. Zkontrolujte připojení a zkuste to znovu.',
        )
      }

      throw new ApiError(
        status,
        messageFromBody(body, status),
        body,
      )
    }

    throw error
  }
}
