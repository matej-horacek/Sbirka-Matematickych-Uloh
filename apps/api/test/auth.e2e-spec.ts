import type { Response } from 'supertest';
import { SEED_PASSWORD } from '../src/database/mock-seed.js';
import { useTestApp } from './support/app.js';
import { signAccessToken } from './support/auth.js';
import { expectError } from './support/expect.js';

// register / login / getCurrentUser / refreshSession / logout, plus the CSRF header.
// Spec: access_token = JWT (~15 min, Path=/api), refresh_token = opaque, rotated (Path=/api/v1/auth);
// both HttpOnly; SameSite=Lax. Seeded users: <name>@example.test with SEED_PASSWORD; `blocked` is blocked.
describe('Authentication', () => {
  const ctx = useTestApp();

  /** Set-Cookie headers of a response, as { name: { value, raw } }. */
  function cookies(res: Response): Record<string, { value: string; raw: string }> {
    const list = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
    return Object.fromEntries(
      list.map((raw) => {
        const [pair] = raw.split(';');
        const i = pair.indexOf('=');
        return [pair.slice(0, i), { value: pair.slice(i + 1), raw }];
      }),
    );
  }

  /** `Cookie` header holding the given cookies of a response. */
  const cookieHeader = (res: Response, ...names: string[]) => {
    const c = cookies(res);
    return names.map((n) => `${n}=${c[n].value}`).join('; ');
  };

  const login = (email = 'jan@example.test', password = SEED_PASSWORD) =>
    ctx().api.post('/auth/login', { email, password });

  describe('register POST /auth/register', () => {
    const body = { email: 'Anna.Novakova@Skola.cz', username: 'anovakova', password: 'tajne-heslo-123', displayName: 'Anna Nováková' };

    it('201: creates a REGISTERED_TEACHER, sets both cookies and logs in', async () => {
      const { api, store } = ctx();
      const res = await api.post('/auth/register', body).expect(201);
      expect(res.body).toMatchObject({
        username: 'anovakova',
        displayName: 'Anna Nováková',
        email: 'anna.novakova@skola.cz', // stored lower-case
        role: 'REGISTERED_TEACHER',
      });
      expect(res.body).not.toHaveProperty('passwordHash');
      await store.expectRecord('users', res.body.id, { username: 'anovakova', status: 'ACTIVE' });

      const c = cookies(res);
      expect(c.access_token.raw).toMatch(/Path=\/api;/);
      expect(c.refresh_token.raw).toMatch(/Path=\/api\/v1\/auth;/);
      for (const name of ['access_token', 'refresh_token']) {
        expect(c[name].raw).toMatch(/HttpOnly/);
        expect(c[name].raw).toMatch(/SameSite=Lax/);
      }
      // the access cookie is a real JWT (three dot-separated parts) …
      expect(c.access_token.value.split('.')).toHaveLength(3);
      // … and it works right away
      const me = await api.withHeaders({ Cookie: cookieHeader(res, 'access_token') }).get('/auth/me').expect(200);
      expect(me.body.id).toBe(res.body.id);
    });

    it('the password is stored only as a hash', async () => {
      const { api, store } = ctx();
      const res = await api
        .post('/auth/register', { email: 'hash@skola.cz', username: 'hashuser', password: 'tajne-heslo-123' })
        .expect(201);
      const row = await store.expectRecord('users', res.body.id);
      expect(row.passwordHash).toMatch(/^\$argon2id\$/);
      expect(row.passwordHash).not.toContain('tajne-heslo-123');
      expect(res.body.displayName).toBe('hashuser'); // no displayName → the username
    });

    it.each([
      ['a short password', { ...body, email: 'a1@skola.cz', username: 'user-a1', password: 'short' }],
      ['an invalid email', { ...body, email: 'not-an-email', username: 'user-a2' }],
      ['a too short username', { ...body, email: 'a3@skola.cz', username: 'a' }],
      ['a missing password', { email: 'a4@skola.cz', username: 'user-a4' }],
      ['an unknown language', { ...body, email: 'a5@skola.cz', username: 'user-a5', language: 'xx' }],
    ])('400 VALIDATION_FAILED for %s, nothing stored', async (_n, payload) => {
      const { api, store } = ctx();
      const before = await store.countRecords('users');
      expectError(await api.post('/auth/register', payload), 400, 'VALIDATION_FAILED');
      expect(await store.countRecords('users')).toBe(before);
    });

    it('409 EMAIL_TAKEN (also with different letter case)', async () => {
      const { api, store } = ctx();
      const before = await store.countRecords('users');
      const res = await api.post('/auth/register', { email: 'JAN@example.test', username: 'someone-new', password: 'tajne-heslo-123' });
      expectError(res, 409, 'EMAIL_TAKEN');
      expect(await store.countRecords('users')).toBe(before);
    });

    it('409 USERNAME_TAKEN', async () => {
      const res = await ctx().api.post('/auth/register', { email: 'new@skola.cz', username: 'petr', password: 'tajne-heslo-123' });
      expectError(res, 409, 'USERNAME_TAKEN');
    });
  });

  describe('login POST /auth/login', () => {
    it('200: sets both cookies and returns the current user', async () => {
      const res = await login().expect(200);
      expect(res.body).toMatchObject({ username: 'jan', email: 'jan@example.test', role: 'TRUSTED_TEACHER' });
      expect(Object.keys(cookies(res)).sort()).toEqual(['access_token', 'refresh_token']);
    });

    it('401 INVALID_CREDENTIALS for a wrong password and for an unknown email (same answer)', async () => {
      const wrong = await login('jan@example.test', 'wrong-password');
      const unknown = await login('nobody@example.test', SEED_PASSWORD);
      expectError(wrong, 401, 'INVALID_CREDENTIALS');
      expectError(unknown, 401, 'INVALID_CREDENTIALS');
      expect(wrong.body.detail).toBe(unknown.body.detail);
      expect(cookies(wrong)).toEqual({});
    });

    it('403 ACCOUNT_BLOCKED only after a correct password', async () => {
      expectError(await login('blocked@example.test'), 403, 'ACCOUNT_BLOCKED');
      expectError(await login('blocked@example.test', 'wrong-password'), 401, 'INVALID_CREDENTIALS');
    });

    it('400 VALIDATION_FAILED without a password', async () => {
      expectError(await ctx().api.post('/auth/login', { email: 'jan@example.test' }), 400, 'VALIDATION_FAILED');
    });
  });

  describe('getCurrentUser GET /auth/me', () => {
    it('401 without a cookie', async () => {
      expectError(await ctx().api.get('/auth/me'), 401, 'UNAUTHENTICATED');
    });

    it('403 ACCOUNT_BLOCKED for a valid token of a blocked user (a block works at once)', async () => {
      const res = await ctx()
        .api.withHeaders({ Cookie: `access_token=${signAccessToken(4)}` })
        .get('/auth/me');
      expectError(res, 403, 'ACCOUNT_BLOCKED');
    });

    it('401 for an expired access token', async () => {
      const res = await ctx()
        .api.withHeaders({ Cookie: `access_token=${signAccessToken(1, -60)}` })
        .get('/auth/me');
      expectError(res, 401, 'UNAUTHENTICATED');
    });
  });

  describe('refreshSession POST /auth/refresh', () => {
    it('200: rotates the refresh token and issues a new access token', async () => {
      const { api } = ctx();
      const first = await login().expect(200);
      const res = await api
        .withHeaders({ Cookie: cookieHeader(first, 'refresh_token') })
        .post('/auth/refresh')
        .expect(200);
      expect(res.body.username).toBe('jan');
      expect(cookies(res).refresh_token.value).not.toBe(cookies(first).refresh_token.value);
      const me = await api.withHeaders({ Cookie: cookieHeader(res, 'access_token') }).get('/auth/me').expect(200);
      expect(me.body.username).toBe('jan');
    });

    it('works with an expired access token (the 401 → refresh → retry flow of the web client)', async () => {
      const { api } = ctx();
      const session = await login().expect(200);
      const expired = signAccessToken(1, -60);
      expectError(await api.withHeaders({ Cookie: `access_token=${expired}` }).get('/tags'), 401, 'UNAUTHENTICATED');

      const refreshed = await api.withHeaders({ Cookie: cookieHeader(session, 'refresh_token') }).post('/auth/refresh').expect(200);
      await api.withHeaders({ Cookie: cookieHeader(refreshed, 'access_token') }).get('/tags').expect(200);
    });

    it('reusing a rotated token revokes the whole chain (theft detection)', async () => {
      const { api } = ctx();
      const first = await login().expect(200);
      const second = await api.withHeaders({ Cookie: cookieHeader(first, 'refresh_token') }).post('/auth/refresh').expect(200);

      // the OLD token comes back (a thief, or a replay): refused …
      expectError(await api.withHeaders({ Cookie: cookieHeader(first, 'refresh_token') }).post('/auth/refresh'), 401, 'UNAUTHENTICATED');
      // … and the NEW token is dead too, so the real user has to log in again
      expectError(await api.withHeaders({ Cookie: cookieHeader(second, 'refresh_token') }).post('/auth/refresh'), 401, 'UNAUTHENTICATED');
    });

    it('401 without a cookie and with a made-up token', async () => {
      const { api } = ctx();
      expectError(await api.post('/auth/refresh'), 401, 'UNAUTHENTICATED');
      expectError(await api.withHeaders({ Cookie: 'refresh_token=made-up' }).post('/auth/refresh'), 401, 'UNAUTHENTICATED');
    });

    it('401 for an expired refresh token', async () => {
      const { api } = ctx();
      const previous = process.env.REFRESH_TOKEN_TTL_DAYS;
      process.env.REFRESH_TOKEN_TTL_DAYS = '-1'; // tokens issued from now on are already expired
      try {
        const session = await login().expect(200);
        const res = await api.withHeaders({ Cookie: cookieHeader(session, 'refresh_token') }).post('/auth/refresh');
        expectError(res, 401, 'UNAUTHENTICATED');
      } finally {
        if (previous === undefined) delete process.env.REFRESH_TOKEN_TTL_DAYS;
        else process.env.REFRESH_TOKEN_TTL_DAYS = previous;
      }
    });
  });

  describe('logout POST /auth/logout', () => {
    it('204: clears both cookies and the refresh token stops working', async () => {
      const { api } = ctx();
      const session = await login().expect(200);
      const refresh = cookieHeader(session, 'refresh_token');
      const res = await api.withHeaders({ Cookie: refresh }).post('/auth/logout').expect(204);
      const cleared = cookies(res);
      expect(cleared.access_token.value).toBe('');
      expect(cleared.refresh_token.value).toBe('');
      expectError(await api.withHeaders({ Cookie: refresh }).post('/auth/refresh'), 401, 'UNAUTHENTICATED');
    });

    it('204 even with no cookie, a garbage cookie or an already revoked token', async () => {
      const { api } = ctx();
      await api.post('/auth/logout').expect(204);
      await api.withHeaders({ Cookie: 'refresh_token=garbage' }).post('/auth/logout').expect(204);
      const session = await login().expect(200);
      const refresh = cookieHeader(session, 'refresh_token');
      await api.withHeaders({ Cookie: refresh }).post('/auth/logout').expect(204);
      await api.withHeaders({ Cookie: refresh }).post('/auth/logout').expect(204);
    });
  });

  describe('CSRF: X-Requested-With on POST/PATCH/DELETE', () => {
    it('403 CSRF_CHECK_FAILED for login without the header', async () => {
      const res = await ctx().api.raw().post('/api/v1/auth/login').send({ email: 'jan@example.test', password: SEED_PASSWORD });
      expectError(res, 403, 'CSRF_CHECK_FAILED');
      expect(cookies(res)).toEqual({});
    });

    it('403 CSRF_CHECK_FAILED for a logged-in POST without the header; nothing is stored', async () => {
      const { api, store } = ctx();
      const before = await store.countRecords('problems', undefined, { includeDeleted: true });
      const res = await api
        .raw()
        .post('/api/v1/problems')
        .set('Cookie', `access_token=${signAccessToken(1)}`)
        .send({ name: 'N', assignment: 'A' });
      expectError(res, 403, 'CSRF_CHECK_FAILED');
      expect(await store.countRecords('problems', undefined, { includeDeleted: true })).toBe(before);
    });

    it('GET needs no header', async () => {
      const res = await ctx().api.raw().get('/api/v1/tags').set('Cookie', `access_token=${signAccessToken(1)}`);
      expect(res.status).toBe(200);
    });

    it('a Bearer header is no longer a login', async () => {
      const res = await ctx().api.raw().get('/api/v1/tags').set('Authorization', 'Bearer jan');
      expectError(res, 401, 'UNAUTHENTICATED');
    });
  });
});
