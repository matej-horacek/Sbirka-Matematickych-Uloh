// Login headers for the mock (MockAuthGuard). Phase B: build real JWTs here instead;
// tests keep using `as('jan')` etc.
export type Login = 'jan' | 'eva' | 'petr' | 'none';

/** jan = TRUSTED (user 1), eva = VERIFIED (user 2), petr = REGISTERED (user 3). */
export const users = {
  jan: { id: 1, displayName: 'Jan Novák', trust: 'TRUSTED' },
  eva: { id: 2, displayName: 'Eva Svobodová', trust: 'VERIFIED' },
  petr: { id: 3, displayName: 'Petr Dvořák', trust: 'REGISTERED' },
} as const;

export function authHeaders(who: Login): Record<string, string> {
  return who === 'none' ? {} : { Authorization: `Bearer ${who}` };
}

export const auth = {
  jan: authHeaders('jan'),
  eva: authHeaders('eva'),
  petr: authHeaders('petr'),
  none: authHeaders('none'),
};
