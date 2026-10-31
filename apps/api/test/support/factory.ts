import type { Api } from './api';
import type { Login } from './auth';

// Arrange helpers that go through the public API only (never the store), so they work
// unchanged against Prisma in Phase B. Each returns the response body.

let n = 0;

/** createProblem with a unique name; `fields` override the defaults. */
export async function createProblem(api: Api, who: Exclude<Login, 'none'>, fields: Record<string, unknown> = {}) {
  n += 1;
  const res = await api
    .as(who)
    .post('/problems', { name: `Úloha ${n}`, assignment: `Zadání ${n}`, ...fields })
    .expect(201);
  return res.body;
}

/** getProblem as `who` (200 expected). */
export async function getProblem(api: Api, who: Exclude<Login, 'none'>, id: string) {
  return (await api.as(who).get(`/problems/${id}`).expect(200)).body;
}

/** A PRIVATE problem of `who`, published with the given licence (jan → PUBLISHED, eva → REVIEWING). */
export async function createPublished(api: Api, who: 'jan' | 'eva', licenseId: string, fields: Record<string, unknown> = {}) {
  const p = await createProblem(api, who, fields);
  return (await api.as(who).post(`/problems/${p.id}/publish`, { licenseId }).expect(200)).body;
}

/**
 * Spec 2.0.0 way to build a set: create the parent and the children, then move the children in
 * with POST /problems/{id}/children. Needs addSetChild (R-002), so only skipped tests use it.
 */
export async function buildSet(api: Api, who: 'jan' | 'eva' | 'petr', childCount = 2, fields: Record<string, unknown> = {}) {
  const parent = await createProblem(api, who, fields);
  let lockVersion: number = parent.lockVersion;
  let set = parent;
  const children: string[] = [];
  for (let i = 0; i < childCount; i++) {
    const child = await createProblem(api, who, { name: `Část ${i + 1}` });
    set = (await api.as(who).post(`/problems/${parent.id}/children`, { lockVersion, problemId: child.id }).expect(200)).body;
    lockVersion = set.lockVersion;
    children.push(child.id);
  }
  return { set, children };
}
