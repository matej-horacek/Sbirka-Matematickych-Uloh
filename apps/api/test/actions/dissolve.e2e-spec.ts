import { useTestApp } from '../support/app';
import { expectError, ids } from '../support/expect';
import { createProblem } from '../support/factory';
import { malformedIds, seed, unknownId } from '../support/seed';

// dissolveSet — POST /problems/{id}/dissolve
// Spec: author only, only on a set parent. The parent is soft-deleted; every child becomes a standalone
// PRIVATE problem owned by the author. Returns the now-standalone problems in their former order.
// Codes: 403, 404, 409 NOT_A_SET, IS_SET_CHILD.
// Not tested here (O-items): none.
describe('dissolveSet POST /problems/{id}/dissolve', () => {
  const P = seed.problems;

  describe('happy path (response + store)', () => {
    const ctx = useTestApp();

    it('parent soft-deleted; the SAME child records become standalone PRIVATE problems, in former order', async () => {
      const { api, store } = ctx();
      const before = await store.countRecords('problems', undefined, { includeDeleted: true });
      const res = await api.as('jan').post(`/problems/${P.set}/dissolve`).expect(200);

      expect(ids(res.body.items)).toEqual([P.childA, P.childB]);
      for (const item of res.body.items) expect(item.childCount).toBe(0);

      // No new rows: the children are moved, not copied.
      expect(await store.countRecords('problems', undefined, { includeDeleted: true })).toBe(before);
      await store.expectDeleted('problems', P.set);
      for (const id of [P.childA, P.childB]) {
        await store.expectRecord('problems', id, { parentId: null, position: null, publishStatus: 'PRIVATE', authorId: 1 });
      }
      // Visible as standalone problems in the dashboard, the set is gone.
      const mine = await api.as('jan').get('/problems?scope=mine&limit=100').expect(200);
      expect(ids(mine.body.items)).toEqual(expect.arrayContaining([P.childA, P.childB]));
      expect(ids(mine.body.items)).not.toContain(P.set);
      expectError(await api.as('jan').get(`/problems/${P.set}`), 404, 'NOT_FOUND');
    });

    it('a freed child keeps its content, tags and chapters', async () => {
      const { api, store } = ctx();
      const child = await api.as('jan').get(`/problems/${P.childA}`).expect(200);
      expect(child.body).toMatchObject({ name: 'Rovnice a)', parentId: null, children: [] });
      await store.expectRecord('problems', P.childA, { tagIds: [1], chapterIds: [2], result: '\\( x = 4 \\)' });
    });
  });

  describe('a published set', () => {
    const ctx = useTestApp();

    it('children become PRIVATE again (to be published on their own)', async () => {
      const { api, store } = ctx();
      await api.as('jan').post(`/problems/${P.set}/publish`, { licenseId: seed.licenses.ccBy }).expect(200);
      await api.as('jan').post(`/problems/${P.set}/dissolve`).expect(200);
      for (const id of [P.childA, P.childB]) await store.expectRecord('problems', id, { publishStatus: 'PRIVATE', parentId: null });
      const pub = await api.as('eva').get('/problems?scope=public').expect(200);
      expect(ids(pub.body.items)).not.toEqual(expect.arrayContaining([P.childA]));
    });
  });

  describe('409', () => {
    const ctx = useTestApp();

    it('NOT_A_SET on a standalone problem; nothing changes', async () => {
      const { api, store } = ctx();
      const p = await createProblem(api, 'jan');
      expectError(await api.as('jan').post(`/problems/${p.id}/dissolve`), 409, 'NOT_A_SET');
      await store.expectRecord('problems', p.id);
    });

    it('409 on a set child; nothing changes', async () => {
      const { api, store } = ctx();
      const res = await api.as('jan').post(`/problems/${P.childA}/dissolve`);
      expect(res.status).toBe(409);
      await store.expectRecord('problems', P.childA, { parentId: 1 });
      await store.expectRecord('problems', P.set);
    });

    it.skip('the code for a set child is IS_SET_CHILD [R-010]', async () => {
      expectError(await ctx().api.as('jan').post(`/problems/${P.childA}/dissolve`), 409, 'IS_SET_CHILD');
    });
  });

  describe('auth and ownership', () => {
    const ctx = useTestApp();

    it('401 UNAUTHENTICATED without a token', async () => {
      expectError(await ctx().api.post(`/problems/${P.set}/dissolve`), 401, 'UNAUTHENTICATED');
    });

    it('404 NOT_FOUND for another teacher’s PRIVATE set; nothing changes', async () => {
      const { api, store } = ctx();
      expectError(await api.as('eva').post(`/problems/${P.set}/dissolve`), 404, 'NOT_FOUND');
      await store.expectRecord('problems', P.set);
      expect(await store.children(P.set)).toHaveLength(2);
    });

    it('403 FORBIDDEN for another teacher’s PUBLISHED set; nothing changes', async () => {
      const { api, store } = ctx();
      await api.as('jan').post(`/problems/${P.set}/publish`, { licenseId: seed.licenses.ccBy }).expect(200);
      expectError(await api.as('eva').post(`/problems/${P.set}/dissolve`), 403, 'FORBIDDEN');
      expect(await store.children(P.set)).toHaveLength(2);
    });

    it('404 for an unknown or malformed id', async () => {
      const { api } = ctx();
      expectError(await api.as('jan').post(`/problems/${unknownId}/dissolve`), 404, 'NOT_FOUND');
      for (const bad of malformedIds) expectError(await api.as('jan').post(`/problems/${encodeURIComponent(bad)}/dissolve`), 404, 'NOT_FOUND');
    });
  });
});
