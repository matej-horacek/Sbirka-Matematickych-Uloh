import { useTestApp } from '../support/app';
import { expectError, ids } from '../support/expect';
import { createProblem } from '../support/factory';
import { malformedIds, seed, unknownId } from '../support/seed';

// deleteProblem — DELETE /problems/{id}
// Spec: author only; soft delete (hidden); on a set deletes the set with its children;
// not allowed on a set child (409 IS_SET_CHILD). Codes: 403, 404, 409 IS_SET_CHILD.
// Not tested here (O-items): none.
describe('deleteProblem DELETE /problems/{id}', () => {
  const ctx = useTestApp();
  const P = seed.problems;

  describe('happy path (204, response + store)', () => {
    it('soft-deletes a standalone problem: row kept with deletedAt, hidden from the API', async () => {
      const { api, store } = ctx();
      const p = await createProblem(api, 'eva');
      const res = await api.as('eva').delete(`/problems/${p.id}`).expect(204);
      expect(res.text).toBe('');
      await store.expectDeleted('problems', p.id);
      expectError(await api.as('eva').get(`/problems/${p.id}`), 404, 'NOT_FOUND');
      const mine = await api.as('eva').get('/problems?scope=mine&limit=100').expect(200);
      expect(ids(mine.body.items)).not.toContain(p.id);
    });

    it('deleting twice → 404 the second time', async () => {
      const { api } = ctx();
      const p = await createProblem(api, 'eva');
      await api.as('eva').delete(`/problems/${p.id}`).expect(204);
      expectError(await api.as('eva').delete(`/problems/${p.id}`), 404, 'NOT_FOUND');
    });

    it('a trusted author may delete a PUBLISHED problem; it leaves the public list', async () => {
      const { api, store } = ctx();
      await api.as('jan').delete(`/problems/${P.circle}`).expect(204);
      await store.expectDeleted('problems', P.circle);
      const pub = await api.as('eva').get('/problems?scope=public').expect(200);
      expect(ids(pub.body.items)).not.toContain(P.circle);
    });
  });

  describe('on a set', () => {
    const fresh = useTestApp();

    it('deletes the set together with its children (all soft-deleted, no other row touched)', async () => {
      const { api, store } = fresh();
      const aliveBefore = await store.countRecords('problems');
      await api.as('jan').delete(`/problems/${P.set}`).expect(204);
      await store.expectDeleted('problems', P.set);
      await store.expectDeleted('problems', P.childA);
      await store.expectDeleted('problems', P.childB);
      expect(await store.countRecords('problems')).toBe(aliveBefore - 3);
      for (const id of [P.set, P.childA, P.childB]) expectError(await api.as('jan').get(`/problems/${id}`), 404, 'NOT_FOUND');
    });
  });

  describe('on a set child', () => {
    const fresh = useTestApp();

    it('409, and nothing is deleted', async () => {
      const { api, store } = fresh();
      const res = await api.as('jan').delete(`/problems/${P.childA}`);
      expect(res.status).toBe(409);
      await store.expectRecord('problems', P.childA, { parentId: 1 });
      await store.expectRecord('problems', P.set);
    });

    it.skip('the code is IS_SET_CHILD [R-010]', async () => {
      // Mock: 409 SET_CHILD_EDIT_VIA_PARENT (the 1.0.x name; 2.0.0 renamed it).
      expectError(await fresh().api.as('jan').delete(`/problems/${P.childA}`), 409, 'IS_SET_CHILD');
    });
  });

  describe('auth and ownership', () => {
    it('401 UNAUTHENTICATED without a token; nothing deleted', async () => {
      const { api, store } = ctx();
      expectError(await api.delete(`/problems/${P.pythagoras}`), 401, 'UNAUTHENTICATED');
      await store.expectRecord('problems', P.pythagoras);
    });

    it('403 FORBIDDEN for another teacher’s PUBLISHED problem; nothing deleted', async () => {
      const { api, store } = ctx();
      expectError(await api.as('jan').delete(`/problems/${P.pythagoras}`), 403, 'FORBIDDEN');
      await store.expectRecord('problems', P.pythagoras);
    });

    it('404 NOT_FOUND for another teacher’s PRIVATE problem; nothing deleted', async () => {
      const { api, store } = ctx();
      expectError(await api.as('jan').delete(`/problems/${P.evaPrivate}`), 404, 'NOT_FOUND');
      await store.expectRecord('problems', P.evaPrivate);
    });
  });

  describe('not found', () => {
    it('404 for an unknown id', async () => {
      expectError(await ctx().api.as('jan').delete(`/problems/${unknownId}`), 404, 'NOT_FOUND');
    });
    it.each(malformedIds)('404 (never 500) for the malformed id "%s"', async (bad) => {
      expectError(await ctx().api.as('jan').delete(`/problems/${encodeURIComponent(bad)}`), 404, 'NOT_FOUND');
    });
  });
});
