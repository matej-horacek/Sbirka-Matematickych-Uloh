import type { INestApplication } from '@nestjs/common';
import request, { type Test } from 'supertest';
import { authHeaders, CSRF_HEADER, type Login } from './auth.js';
import { contract, type Method } from './contract.js';

export const API_PREFIX = '/api/v1';

export interface Client {
  get(path: string): Test;
  post(path: string, body?: object): Test;
  patch(path: string, body?: object): Test;
  delete(path: string): Test;
}

export interface Api extends Client {
  /** The same client, logged in as a seeded user (access_token cookie). `as('none')` sends no cookie. */
  as(who: Login): Client;
  /** The same client with explicit headers (e.g. a Cookie from a real login). Always sends X-Requested-With. */
  withHeaders(headers: Record<string, string>): Client;
  /** Plain supertest without contract validation, for requests that are outside the spec on purpose. */
  raw(): ReturnType<typeof request>;
}

/**
 * Every request made through this client is checked against openapi.yaml automatically:
 * an undeclared status, a wrong content type or a body that doesn't match the schema
 * fails the test, whatever the test itself asserts.
 */
export function createApi(app: INestApplication): Api {
  const server = app.getHttpServer();

  const call = (headers: Record<string, string>, method: Method, path: string, body?: object): Test => {
    const url = API_PREFIX + path;
    let t = request(server)[method](url).set(headers);
    if (body !== undefined) t = t.send(body);
    return t.expect((res) => contract().assertResponse(method, path, res));
  };

  const clientWith = (headers: Record<string, string>): Client => ({
    get: (path) => call(headers, 'get', path),
    post: (path, body) => call(headers, 'post', path, body),
    patch: (path, body) => call(headers, 'patch', path, body),
    delete: (path) => call(headers, 'delete', path),
  });
  const client = (who: Login): Client => clientWith(authHeaders(who));

  return {
    ...client('none'),
    as: client,
    withHeaders: (headers) => clientWith({ ...CSRF_HEADER, ...headers }),
    raw: () => request(server),
  };
}
