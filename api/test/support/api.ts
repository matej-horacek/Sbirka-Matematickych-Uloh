import type { INestApplication } from '@nestjs/common';
import request, { type Test } from 'supertest';
import { authHeaders, type Login } from './auth';
import { contract, type Method } from './contract';

export const API_PREFIX = '/api/v1';

export interface Client {
  get(path: string): Test;
  post(path: string, body?: object): Test;
  patch(path: string, body?: object): Test;
  delete(path: string): Test;
}

export interface Api extends Client {
  /** The same client, logged in as a mock user. `as('none')` sends no Authorization header. */
  as(who: Login): Client;
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

  const call = (who: Login, method: Method, path: string, body?: object): Test => {
    const url = API_PREFIX + path;
    let t = request(server)[method](url).set(authHeaders(who));
    if (body !== undefined) t = t.send(body);
    return t.expect((res) => contract().assertResponse(method, path, res));
  };

  const client = (who: Login): Client => ({
    get: (path) => call(who, 'get', path),
    post: (path, body) => call(who, 'post', path, body),
    patch: (path, body) => call(who, 'patch', path, body),
    delete: (path) => call(who, 'delete', path),
  });

  return { ...client('none'), as: client, raw: () => request(server) };
}
