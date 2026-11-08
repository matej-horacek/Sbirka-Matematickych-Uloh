import { createHmac } from 'node:crypto';
import { authConfig } from '../../src/config/auth-config.js';

// Test logins: `as('jan')` sends a valid access_token cookie for the seeded user, signed with the
// same key the app verifies with (JWT_SECRET, or the dev default). Signing here, synchronously,
// keeps the ~260 calls fast; the real login/refresh/logout flow is tested in auth.e2e-spec.ts.
// Every request carries X-Requested-With, as the web client does (CSRF guard), even `as('none')`.
export type Login = 'jan' | 'eva' | 'petr' | 'none';

/** jan = TRUSTED (user 1), eva = VERIFIED (user 2), petr = REGISTERED (user 3). */
export const users = {
  jan: { id: 1, displayName: 'Jan Novák', trust: 'TRUSTED' },
  eva: { id: 2, displayName: 'Eva Svobodová', trust: 'VERIFIED' },
  petr: { id: 3, displayName: 'Petr Dvořák', trust: 'REGISTERED' },
} as const;

export const CSRF_HEADER = { 'X-Requested-With': 'XMLHttpRequest' } as const;

const b64url = (v: object | Buffer) => Buffer.from(v instanceof Buffer ? v : JSON.stringify(v)).toString('base64url');

/** A signed HS256 access token for the user id; `expiresInSeconds` may be negative (already expired). */
export function signAccessToken(userId: number, expiresInSeconds = 900, secret = authConfig().jwtSecret): string {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url({ alg: 'HS256', typ: 'JWT' });
  const body = b64url({ sub: String(userId), iat: now, exp: now + expiresInSeconds });
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest();
  return `${head}.${body}.${b64url(sig)}`;
}

export function authHeaders(who: Login): Record<string, string> {
  if (who === 'none') return { ...CSRF_HEADER };
  return { ...CSRF_HEADER, Cookie: `access_token=${signAccessToken(users[who].id)}` };
}

export const auth = {
  jan: authHeaders('jan'),
  eva: authHeaders('eva'),
  petr: authHeaders('petr'),
  none: authHeaders('none'),
};
