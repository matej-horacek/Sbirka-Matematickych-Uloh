import { useTestApp } from '../support/app';
import { expectError, ids } from '../support/expect';
import { buildSet, createProblem } from '../support/factory';
import { malformedIds, seed, unknownId } from '../support/seed';

// reorderSetChild — PATCH /problems/{id}/children/{childId}
// Spec 2.0.0: the set's author. afterId REQUIRED: null = first, a child id = right after that child.
//   400 missing afterId, afterId not in the set or the child itself; 403; 404 (set, or childId not in
//   this set); 409 LOCK_MISMATCH. Returns the whole set (new order and lockVersion).
// Not asserted: the set's `version` after a structure change (Q-004).
// Not reachable through the API: the 202 path (see add-child.e2e-spec.ts).
describe('reorderSetChild PATCH /problems/{id}/children/{childId}', () => {
  const ctx = useTestApp();
  const move = (who: 'jan' | 'eva', setId: string, childId: string, body: object) =>
    ctx().api.as(who).patch(`/problems/${setId}/children/${childId}`, body);

  /** A set of eva's with children [c1, c2, c3] (needs addSetChild, R-002). */
  const three = () => buildSet(ctx().api, 'eva', 3);

  describe('positions', () => {
    it('afterId null → first', async () => {
      const { set, children: [c1, c2, c3] } = await three();
      const res = await move('eva', set.id, c3, { lockVersion: set.lockVersion, afterId: null }).expect(200);
      expect(ids(res.body.children)).toEqual([c3, c1, c2]);
    });

    it('afterId = a child → right after it (response and store order)', async () => {
      const { store } = ctx();
      const { set, children: [c1, c2, c3] } = await three();
      const res = await move('eva', set.id, c1, { lockVersion: set.lockVersion, afterId: c2 }).expect(200);
      expect(ids(res.body.children)).toEqual([c2, c1, c3]);
      expect((await store.children(set.id)).map((c) => c.id)).toEqual([c2, c1, c3].map((id) => store.toDbId(id)));
    });

    it('afterId = the last child → moves to the end', async () => {
      const { set, children: [c1, c2, c3] } = await three();
      const res = await move('eva', set.id, c1, { lockVersion: set.lockVersion, afterId: c3 }).expect(200);
      expect(ids(res.body.children)).toEqual([c2, c3, c1]);
    });

    it('moving the first child to first is a no-op on the order (still 200)', async () => {
      const { set, children } = await three();
      const res = await move('eva', set.id, children[0], { lockVersion: set.lockVersion, afterId: null }).expect(200);
      expect(ids(res.body.children)).toEqual(children);
    });

    it('several moves in a row, each with the lockVersion from the previous response', async () => {
      const { set, children: [c1, c2, c3] } = await three();
      let r = await move('eva', set.id, c3, { lockVersion: set.lockVersion, afterId: null }).expect(200);
      r = await move('eva', set.id, c1, { lockVersion: r.body.lockVersion, afterId: c3 }).expect(200);
      r = await move('eva', set.id, c2, { lockVersion: r.body.lockVersion, afterId: null }).expect(200);
      expect(ids(r.body.children)).toEqual([c2, c3, c1]);
    });
  });

  describe('store side effects', () => {
    it('no record is created or deleted; ids, parent and content stay the same', async () => {
      const { store } = ctx();
      const { set, children } = await three();
      const before = await store.countRecords('problems', undefined, { includeDeleted: true });
      const rows = structuredClone(await Promise.all(children.map((c) => store.expectRecord('problems', c))));
      await move('eva', set.id, children[2], { lockVersion: set.lockVersion, afterId: null }).expect(200);
      expect(await store.countRecords('problems', undefined, { includeDeleted: true })).toBe(before);
      for (const r of rows) {
        await store.expectRecord('problems', r.id, { parentId: r.parentId, name: r.name, assignment: r.assignment, lockVersion: r.lockVersion });
      }
    });

    it('raises the set’s lockVersion by one (response and store)', async () => {
      const { store } = ctx();
      const { set, children } = await three();
      const res = await move('eva', set.id, children[1], { lockVersion: set.lockVersion, afterId: null }).expect(200);
      expect(res.body.lockVersion).toBe(set.lockVersion + 1);
      await store.expectRecord('problems', set.id, { lockVersion: set.lockVersion + 1 });
    });
  });

  describe('400 VALIDATION_FAILED, order unchanged', () => {
    it.each([
      ['missing afterId', () => ({})],
      ['afterId is the child itself', (c: string[]) => ({ afterId: c[1] })],
      ['afterId not in the set', () => ({ afterId: seed.problems.circle })],
      ['afterId unknown', () => ({ afterId: unknownId })],
      ['afterId malformed', () => ({ afterId: '!!!' })],
      ['missing lockVersion', (c: string[]) => ({ lockVersion: undefined, afterId: c[0] })],
    ])('%s', async (_, body) => {
      const { store } = ctx();
      const { set, children } = await three();
      expectError(await move('eva', set.id, children[1], { lockVersion: set.lockVersion, ...body(children) }), 400, 'VALIDATION_FAILED');
      expect((await store.children(set.id)).map((c) => c.id)).toEqual(children.map((id) => store.toDbId(id)));
      await store.expectRecord('problems', set.id, { lockVersion: set.lockVersion });
    });
  });

  describe('409 / 404', () => {
    it('409 LOCK_MISMATCH for a stale set lockVersion; order unchanged', async () => {
      const { store } = ctx();
      const { set, children } = await three();
      expectError(await move('eva', set.id, children[2], { lockVersion: set.lockVersion - 1, afterId: null }), 409, 'LOCK_MISMATCH');
      expect((await store.children(set.id)).map((c) => c.id)).toEqual(children.map((id) => store.toDbId(id)));
    });

    it('the CHILD’s lockVersion is not the set’s lockVersion (409)', async () => {
      // A child moved in keeps lockVersion 1; the set's is 4 after three adds.
      const { set, children } = await three();
      expect(set.lockVersion).not.toBe(1);
      expectError(await move('eva', set.id, children[2], { lockVersion: 1, afterId: null }), 409, 'LOCK_MISMATCH');
    });

    it('404 when childId is not a child of this set', async () => {
      const { api } = ctx();
      const { set } = await three();
      const other = await createProblem(api, 'eva');
      expectError(await move('eva', set.id, other.id, { lockVersion: set.lockVersion, afterId: null }), 404, 'NOT_FOUND');
    });

    it('404 for a child of ANOTHER set of the same author', async () => {
      const a = await three();
      const b = await buildSet(ctx().api, 'eva', 1);
      expectError(await move('eva', a.set.id, b.children[0], { lockVersion: a.set.lockVersion, afterId: null }), 404, 'NOT_FOUND');
    });

    it('404 for an unknown or malformed set / child id', async () => {
      const { set, children } = await three();
      expectError(await move('eva', unknownId, children[0], { lockVersion: 1, afterId: null }), 404, 'NOT_FOUND');
      expectError(await move('eva', set.id, unknownId, { lockVersion: set.lockVersion, afterId: null }), 404, 'NOT_FOUND');
      for (const bad of malformedIds) {
        expectError(await move('eva', set.id, encodeURIComponent(bad), { lockVersion: set.lockVersion, afterId: null }), 404, 'NOT_FOUND');
      }
    });
  });

  describe('auth and ownership', () => {
    // The 404 test for a foreign PRIVATE set already passes under test:unskipped, by accident (Nest's 404 for
    // the missing route looks like the spec's 404). Keep it skipped until the route exists.
    it('401 without a token', async () => {
      const { set, children } = await three();
      expectError(await ctx().api.patch(`/problems/${set.id}/children/${children[0]}`, { lockVersion: set.lockVersion, afterId: null }), 401, 'UNAUTHENTICATED');
    });

    it('404 on another teacher’s PRIVATE set; order unchanged', async () => {
      const { store } = ctx();
      expectError(await move('eva', seed.problems.set, seed.problems.childB, { lockVersion: 3, afterId: null }), 404, 'NOT_FOUND');
      expect((await store.children(seed.problems.set)).map((c) => c.id)).toEqual([2, 3]);
    });

    it('403 on another teacher’s PUBLISHED set; order unchanged', async () => {
      const { api, store } = ctx();
      const { set, children } = await buildSet(api, 'jan', 2);
      const pub = (await api.as('jan').post(`/problems/${set.id}/publish`, { licenseId: seed.licenses.ccBy }).expect(200)).body;
      expectError(await move('eva', set.id, children[1], { lockVersion: pub.lockVersion, afterId: null }), 403, 'FORBIDDEN');
      expect((await store.children(set.id)).map((c) => c.id)).toEqual(children.map((id) => store.toDbId(id)));
    });
  });
});
