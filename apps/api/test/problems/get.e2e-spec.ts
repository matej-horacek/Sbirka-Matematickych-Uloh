import { useTestApp } from '../support/app';
import { users } from '../support/auth';
import { AUTHOR_ONLY_DETAIL_FIELDS, expectError, ids } from '../support/expect';
import { malformedIds, seed, unknownId } from '../support/seed';

// getProblem — GET /problems/{id}
// Spec: the author, or any logged-in teacher when published; otherwise 404 (existence not revealed).
// Author-only fields: status, version, lockVersion (also on each child), originalId.
// Not tested here (O-items): none. Read-only: one app for the whole file.
describe('getProblem GET /problems/{id}', () => {
  const ctx = useTestApp();
  const P = seed.problems;

  describe('the author', () => {
    it('sees a set with its children in position order and the author-only fields', async () => {
      const { api, store } = ctx();
      const res = await api.as('jan').get(`/problems/${P.set}`).expect(200);
      expect(res.body).toMatchObject({
        id: P.set,
        name: 'Řešte rovnice',
        author: { id: seed.users.jan, displayName: users.jan.displayName },
        childCount: 2,
        status: 'PRIVATE',
        version: 1,
        lockVersion: 3,
        parentId: null,
      });
      expect(ids(res.body.children)).toEqual([P.childA, P.childB]);
      // The store agrees on owner, versions and the order of the children.
      await store.expectRecord('problems', P.set, { authorId: users.jan.id, version: 1, lockVersion: 3, publishStatus: 'PRIVATE' });
      expect((await store.children(P.set)).map((c) => c.id)).toEqual([store.toDbId(P.childA), store.toDbId(P.childB)]);
    });

    it('sees tags and chapters with their scope (global / personal)', async () => {
      const res = await ctx().api.as('jan').get(`/problems/${P.set}`).expect(200);
      expect(res.body.tags).toEqual([
        { id: seed.tags.linear, name: 'lineární rovnice', scope: 'global' },
        { id: seed.tags.quadratic, name: 'kvadratické rovnice', scope: 'global' },
        { id: seed.tags.janPersonal, name: 'opakování 2.A', scope: 'personal' },
      ]);
      expect(res.body.chapters).toEqual([{ id: seed.chapters.equations, name: 'Rovnice', scope: 'global' }]);
    });

    it('a child: parentId points to the set, children is empty', async () => {
      const res = await ctx().api.as('jan').get(`/problems/${P.childA}`).expect(200);
      expect(res.body).toMatchObject({ id: P.childA, parentId: P.set, children: [], childCount: 0 });
    });

    it('source: OWN has no citation; LICENSED_USE shows citation and licence', async () => {
      const { api } = ctx();
      const own = await api.as('jan').get(`/problems/${P.circle}`).expect(200);
      expect(own.body.source).toEqual({
        type: 'OWN',
        license: { id: seed.licenses.ccBy, name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
        citation: null,
        licenseNote: null,
        showInWeb: true,
        showInPdf: true,
      });
      const licensed = await api.as('jan').get(`/problems/${P.textbook}`).expect(200);
      expect(licensed.body.source).toMatchObject({
        type: 'LICENSED_USE',
        citation: 'Učebnice Matematika 1, s. 42',
        license: { id: seed.licenses.allRightsReserved, name: 'Všechna práva vyhrazena', url: null },
      });
    });

    it.skip('each child carries its own lockVersion (author only) [R-008]', async () => {
      // Spec ProblemDetailCore.lockVersion: "Each child has its own lockVersion for editing its content."
      const res = await ctx().api.as('jan').get(`/problems/${P.set}`).expect(200);
      expect(res.body.children.map((c: { lockVersion?: number }) => c.lockVersion)).toEqual([1, 1]);
    });

    it.skip('sees originalId (null for a problem that is not a copy) [R-008]', async () => {
      const res = await ctx().api.as('jan').get(`/problems/${P.set}`).expect(200);
      expect(res.body).toHaveProperty('originalId', null);
    });
  });

  describe('another teacher', () => {
    it.each(['eva', 'petr'] as const)('%s sees a published problem without author-only fields', async (who) => {
      const res = await ctx().api.as(who).get(`/problems/${P.circle}`).expect(200);
      expect(res.body.id).toBe(P.circle);
      for (const f of AUTHOR_ONLY_DETAIL_FIELDS) expect(res.body).not.toHaveProperty(f);
    });

    it('gets 404 NOT_FOUND for a private problem (existence not revealed)', async () => {
      const { api } = ctx();
      expectError(await api.as('jan').get(`/problems/${P.evaPrivate}`), 404, 'NOT_FOUND');
      expectError(await api.as('eva').get(`/problems/${P.set}`), 404, 'NOT_FOUND');
      expectError(await api.as('eva').get(`/problems/${P.childA}`), 404, 'NOT_FOUND');
    });

    it('the 404 for a hidden problem looks exactly like the 404 for a missing one', async () => {
      const { api } = ctx();
      const hidden = await api.as('jan').get(`/problems/${P.evaPrivate}`);
      const missing = await api.as('jan').get(`/problems/${unknownId}`);
      const strip = (b: Record<string, unknown>) => ({ ...b, instance: undefined, requestId: undefined });
      expect(strip(hidden.body)).toEqual(strip(missing.body));
    });
  });

  describe('not found / bad id', () => {
    it('404 NOT_FOUND for a well-formed unknown id', async () => {
      expectError(await ctx().api.as('jan').get(`/problems/${unknownId}`), 404, 'NOT_FOUND');
    });

    it.each(malformedIds)('404 NOT_FOUND (never 500) for the malformed id "%s"', async (bad) => {
      expectError(await ctx().api.as('jan').get(`/problems/${encodeURIComponent(bad)}`), 404, 'NOT_FOUND');
    });

    it('a raw integer id is not accepted as an id', async () => {
      // IDs are Sqids in the API; "4" must not reach problem #4 (Obsah kruhu, published).
      expectError(await ctx().api.as('jan').get('/problems/4'), 404, 'NOT_FOUND');
    });
  });

  describe('auth', () => {
    it('401 UNAUTHENTICATED without a token, even for a published problem', async () => {
      expectError(await ctx().api.get(`/problems/${P.circle}`), 401, 'UNAUTHENTICATED');
    });
  });
});
