/**
 * Auth settings, read from the environment on every call (so tests can change them):
 *   JWT_SECRET                 signing key of the access token (required when NODE_ENV=production)
 *   ACCESS_TOKEN_TTL_SECONDS   default 900 (15 min)
 *   REFRESH_TOKEN_TTL_DAYS     default 7
 *   COOKIE_SECURE              "true"/"false"; default: true only in production (Secure cookies need https)
 */
const DEV_SECRET = 'dev-only-insecure-jwt-secret-do-not-use-in-production';

export interface AuthConfig {
  jwtSecret: Uint8Array;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  cookieSecure: boolean;
}

export function authConfig(): AuthConfig {
  const production = process.env.NODE_ENV === 'production';
  const secret = process.env.JWT_SECRET ?? (production ? undefined : DEV_SECRET);
  if (!secret) throw new Error('JWT_SECRET is required when NODE_ENV=production.');
  return {
    jwtSecret: new TextEncoder().encode(secret),
    accessTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 15 * 60),
    refreshTtlSeconds: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7) * 24 * 60 * 60,
    cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : production,
  };
}
