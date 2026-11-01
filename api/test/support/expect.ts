import type { Response } from 'supertest';

/** Asserts an RFC 9457 error with the given status and `code` (the contract check covers the shape). */
export function expectError(res: Response, status: number, code: string): void {
  expect({ status: res.status, code: res.body?.code }).toEqual({ status, code });
  expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
  expect(res.body.status).toBe(status);
}

/** The fields only the author may see on a problem detail (spec: "Present only for the author"). */
export const AUTHOR_ONLY_DETAIL_FIELDS = ['status', 'version', 'lockVersion', 'originalId'] as const;

/** Content fields that a copy or take-over carries over (spec: name, assignment, result, language, difficulty). */
export const CONTENT_FIELDS = ['name', 'assignment', 'result', 'language', 'difficulty'] as const;

export function pickContent(p: Record<string, unknown>) {
  return Object.fromEntries(CONTENT_FIELDS.map((k) => [k, p[k]]));
}

export const ids = (items: { id: string }[]) => items.map((i) => i.id);
