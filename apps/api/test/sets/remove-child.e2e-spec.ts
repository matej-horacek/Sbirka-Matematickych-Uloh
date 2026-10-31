import { useTestApp } from '../support/app';
import { expectError, ids } from '../support/expect';
import { buildSet, createProblem, getProblem } from '../support/factory';
import { malformedIds, seed, unknownId } from '../support/seed';

// removeSetChild — DELETE /problems/{id}/children/{childId}
// Spec 2.0.0: the set's author. The child is NOT deleted: it becomes a standalone PRIVATE problem.
//   Last child out → the set is a plain problem again (childCount 0). The set's lockVersion travels in
//   If-Match as an ETag ("4"). 200 with the whole set (not 204). 400 missing/malformed If-Match;
//   403; 404 (set, or childId not in this set); 412 LOCK_MISMATCH.
// Not asserted: the set's `version` after a structure change (Q-004).
// Not reachable through the API: the 202 path (see add-child.e2e-spec.ts).
describe('removeSetChild DELETE /problems/{id}/children/{childId}', () => {
  const ctx = useTestApp();
  const etag = (lockVersion: number) => `"${lockVersion}"`;
  const takeOut = (who: 'jan' | 'eva', setId: string, childId: string, ifMatch?: string) => {
    const req = ctx().api.as(who).delete(`/problems/${setId}/children/${childId}`);
    return ifMatch === undefined ? req : req.set('If-Match', ifMatch);
  };

  describe('happy path (200, whole set + store)', () => {
    it('the child becomes a standalone PRIVATE problem: same record, not deleted', async () => {
      const { api, store } = ctx();
      const { set, children: [c1, c2] } = await buildSet(api, 'eva', 2);
      const before = await store.countRecords('problems', undefined, { includeDeleted: true });

      const res = await takeOut('eva', set.id, c1, etag(set.lockVersion)).expect(200);

      expect(res.body).toMatchObject({ id: set.id, childCount: 1 });
      expect(ids(res.body.children)).toEqual([c2]);
      expect(await store.countRecords('problems', undefined, { includeDeleted: true })).toBe(before);
      await store.expectRecord('problems', c1, { parentId: null, publishStatus: 'PRIVATE', authorId: 2 });
      const freed = await getProblem(api, 'eva', c1);
      expect(freed).toMatchObject({ parentId: null, children: [], status: 'PRIVATE' });
      const mine = await api.as('eva').get('/problems?scope=mine&limit=100').expect(200);
      expect(ids(mine.body.items)).toContain(c1);
    });

    it('raises the set’s lockVersion by one (response and store)', async () => {
      const { api, store } = ctx();
      const { set, children } = await buildSet(api, 'eva', 2);
      const res = await takeOut('eva', set.id, children[1], etag(set.lockVersion)).expect(200);
      expect(res.body.lockVersion).toBe(set.lockVersion + 1);
      await store.expectRecord('problems', set.id, { lockVersion: set.lockVersion + 1 });
    });

    it('the remaining children keep their order', async () => {
      const { api } = ctx();
      const { set, children: [c1, c2, c3] } = await buildSet(api, 'eva', 3);
      const res = await takeOut('eva', set.id, c2, etag(set.lockVersion)).expect(200);
      expect(ids(res.body.children)).toEqual([c1, c3]);
    });

    it('last child out → the set is a plain problem again (childCount 0)', async () => {
      const { api, store } = ctx();
      const { set, children: [c1] } = await buildSet(api, 'eva', 1);
      const res = await takeOut('eva', set.id, c1, etag(set.lockVersion)).expect(200);
      expect(res.body).toMatchObject({ childCount: 0, children: [] });
      expect(await store.children(set.id)).toEqual([]);
      await store.expectRecord('problems', set.id);
      // A plain problem may have a result again.
      await api.as('eva').patch(`/problems/${set.id}`, { lockVersion: res.body.lockVersion, result: 'x = 1' }).expect(200);
    });

    it('a child of a PUBLISHED set becomes PRIVATE when taken out', async () => {
      const { api, store } = ctx();
      const { set, children } = await buildSet(api, 'jan', 2);
      const pub = (await api.as('jan').post(`/problems/${set.id}/publish`, { licenseId: seed.licenses.ccBy }).expect(200)).body;
      await takeOut('jan', set.id, children[0], etag(pub.lockVersion)).expect(200);
      await store.expectRecord('problems', children[0], { publishStatus: 'PRIVATE', parentId: null });
      await store.expectRecord('problems', set.id, { publishStatus: 'PUBLISHED' });
    });

    it('taken out, then deleted with DELETE /problems/{childId} (the documented two-step delete)', async () => {
      const { api, store } = ctx();
      const { set, children } = await buildSet(api, 'eva', 2);
      await takeOut('eva', set.id, children[0], etag(set.lockVersion)).expect(200);
      await api.as('eva').delete(`/problems/${children[0]}`).expect(204);
      await store.expectDeleted('problems', children[0]);
      await store.expectRecord('problems', children[1], { parentId: store.toDbId(set.id) });
    });
  });

  describe('If-Match (optimistic lock on DELETE)', () => {
    it('412 LOCK_MISMATCH when If-Match does not match; nothing changes', async () => {
      const { api, store } = ctx();
      const { set, children } = await buildSet(api, 'eva', 2);
      expectError(await takeOut('eva', set.id, children[0], etag(set.lockVersion - 1)), 412, 'LOCK_MISMATCH');
      await store.expectRecord('problems', children[0], { parentId: store.toDbId(set.id) });
      await store.expectRecord('problems', set.id, { lockVersion: set.lockVersion });
    });

    it('412 when the set changed in between (a stale ETag from an earlier response)', async () => {
      const { api } = ctx();
      const { set, children: [c1, c2] } = await buildSet(api, 'eva', 2);
      await takeOut('eva', set.id, c1, etag(set.lockVersion)).expect(200);
      expectError(await takeOut('eva', set.id, c2, etag(set.lockVersion)), 412, 'LOCK_MISMATCH');
    });

    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['not quoted', 'abc'],
      ['quoted, not a number', '"abc"'],
    ])('400 VALIDATION_FAILED for a %s If-Match; nothing changes', async (_, header) => {
      const { api, store } = ctx();
      const { set, children } = await buildSet(api, 'eva', 1);
      expectError(await takeOut('eva', set.id, children[0], header), 400, 'VALIDATION_FAILED');
      await store.expectRecord('problems', children[0], { parentId: store.toDbId(set.id) });
    });
    // Not asserted: an unquoted number (If-Match: 4). The spec's example is quoted (an ETag) and says
    // "malformed → 400", but does not say whether a bare number is malformed.
  });

  describe('404', () => {
    it('childId is not a child of this set (a standalone problem)', async () => {
      const { api, store } = ctx();
      const { set } = await buildSet(api, 'eva', 1);
      const other = await createProblem(api, 'eva');
      expectError(await takeOut('eva', set.id, other.id, etag(set.lockVersion)), 404, 'NOT_FOUND');
      await store.expectRecord('problems', set.id, { lockVersion: set.lockVersion });
    });

    it('childId is a child of another set', async () => {
      const { api } = ctx();
      const a = await buildSet(api, 'eva', 1);
      const b = await buildSet(api, 'eva', 1);
      expectError(await takeOut('eva', a.set.id, b.children[0], etag(a.set.lockVersion)), 404, 'NOT_FOUND');
    });

    it('unknown or malformed ids', async () => {
      const { api } = ctx();
      const { set, children } = await buildSet(api, 'eva', 1);
      expectError(await takeOut('eva', unknownId, children[0], etag(1)), 404, 'NOT_FOUND');
      expectError(await takeOut('eva', set.id, unknownId, etag(set.lockVersion)), 404, 'NOT_FOUND');
      for (const bad of malformedIds) expectError(await takeOut('eva', set.id, encodeURIComponent(bad), etag(set.lockVersion)), 404, 'NOT_FOUND');
    });
  });

  describe('auth and ownership', () => {
    // The 404 test for a foreign PRIVATE set already passes under test:unskipped, by accident (Nest's 404 for
    // the missing route looks like the spec's 404). Keep it skipped until the route exists.
    it('401 without a token', async () => {
      const res = await ctx().api.delete(`/problems/${seed.problems.set}/children/${seed.problems.childA}`).set('If-Match', etag(3));
      expectError(res, 401, 'UNAUTHENTICATED');
    });

    it('404 on another teacher’s PRIVATE set; nothing changes', async () => {
      const { store } = ctx();
      expectError(await takeOut('eva', seed.problems.set, seed.problems.childA, etag(3)), 404, 'NOT_FOUND');
      await store.expectRecord('problems', seed.problems.childA, { parentId: 1 });
    });

    it('403 on another teacher’s PUBLISHED set; nothing changes', async () => {
      const { api, store } = ctx();
      const { set, children } = await buildSet(api, 'jan', 1);
      const pub = (await api.as('jan').post(`/problems/${set.id}/publish`, { licenseId: seed.licenses.ccBy }).expect(200)).body;
      expectError(await takeOut('eva', set.id, children[0], etag(pub.lockVersion)), 403, 'FORBIDDEN');
      await store.expectRecord('problems', children[0], { parentId: store.toDbId(set.id), publishStatus: 'PUBLISHED' });
    });
  });
});
