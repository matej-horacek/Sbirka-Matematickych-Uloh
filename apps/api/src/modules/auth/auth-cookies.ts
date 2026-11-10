import type { CookieOptions, Response } from 'express';
import { authConfig } from '../../config/auth-config.js';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

// Paths from the spec: the access cookie goes with every API call, the refresh cookie
// only to the auth endpoints (so a request to any other endpoint never carries it).
const ACCESS_PATH = '/api';
const REFRESH_PATH = '/api/v1/auth';

function options(path: string, maxAgeSeconds?: number): CookieOptions {
  return {
    httpOnly: true,
    secure: authConfig().cookieSecure,
    sameSite: 'lax',
    path,
    ...(maxAgeSeconds !== undefined && { maxAge: maxAgeSeconds * 1000 }),
  };
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  const { accessTtlSeconds, refreshTtlSeconds } = authConfig();
  res.cookie(ACCESS_COOKIE, accessToken, options(ACCESS_PATH, accessTtlSeconds));
  res.cookie(REFRESH_COOKIE, refreshToken, options(REFRESH_PATH, refreshTtlSeconds));
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, options(ACCESS_PATH));
  res.clearCookie(REFRESH_COOKIE, options(REFRESH_PATH));
}
