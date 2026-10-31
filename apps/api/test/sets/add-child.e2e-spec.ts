import { useTestApp } from '../support/app';
import { users } from '../support/auth';
import { expectError, ids } from '../support/expect';
import { buildSet, createProblem, createPublished, getProblem } from '../support/factory';
import { malformedIds, seed, unknownId } from '../support/seed';

// addSetChild — POST /problems/{id}/children           
// Spec 2.0.0: the set's author. `id` = a set, or a standalone problem that becomes a set with its first child.
//   problemId  = MOVE your own PRIVATE standalone problem (not a set) in: same record, no copy.
//   copyFromId = COPY any problem you can see (not a set) in: a new record, usual copy rules.
//   afterId: missing = end, null = first, a child id = right after it.
//   The set must not be a child and must have no result. The child takes the set's status; in a published
//   set, a child without a licence takes the set's licence. Returns the whole set with the new lockVersion.
//   400 both/neither ids, unknown afterId, problem not found; 403; 404 (the set);
//   409 LOCK_MISMATCH, SET_PARENT_HAS_RESULT, IS_SET_CHILD, CANNOT_ADD_TO_SET, LICENSE_REQUIRED.
// Not asserted (unclear in the spec, see QUESTIONS.md): the set's `version` after a structure change (Q-004);
//   moving in another teacher's PRIVATE problem (400 "not found" vs 409 "not yours", Q-008);
//   copying in a child of another set (Q-008).
// Not reachable through the API: the 202 path (only trusted teachers reach PUBLISHED; they get 200).
describe('addSetChild POST /problems/{id}/children', () => {
  const ctx = useTestApp();
  const P = seed.problems;
  const add = (who: 'jan' | 'eva' | 'petr', setId: string, body: object) => ctx().api.as(who).post(`/problems/${setId}/children`, body);

  describe('move your own problem in (problemId)', () => {
    it('keeps the id, creates no record, sets parentId; returns the whole set', async () => {
      const { api, store } = ctx();
      const set = await createProblem(api, 'eva');
      const p = await createProblem(api, 'eva', { tagIds: [seed.tags.geometry] });
      const before = await store.countRecords('problems', undefined, { includeDeleted: true });

      const res = await add('eva', set.id, { lockVersion: set.lockVersion, problemId: p.id }).expect(200);

      expect(res.body).toMatchObject({ id: set.id, childCount: 1, parentId: null });
      expect(ids(res.body.children)).toEqual([p.id]);
      expect(await store.countRecords('problems', undefined, { includeDeleted: true })).toBe(before);
      await store.expectRecord('problems', p.id, { parentId: store.toDbId(set.id), authorId: users.eva.id, tagIds: [3], originalProblemId: null });
      expect((await getProblem(api, 'eva', p.id)).parentId).toBe(set.id);
    });

    it('a standalone problem becomes a set with its first child; the moved problem leaves the list', async () => {
      const { api } = ctx();
      const set = await createProblem(api, 'eva');
      const p = await createProblem(api, 'eva');
      await add('eva', set.id, { lockVersion: 1, problemId: p.id }).expect(200);
      const mine = await api.as('eva').get('/problems?scope=mine&limit=100').expect(200);
      expect(ids(mine.body.items)).toContain(set.id);
      expect(ids(mine.body.items)).not.toContain(p.id); // set children are not listed on their own
      expect(mine.body.items.find((i: { id: string }) => i.id === set.id).childCount).toBe(1);
    });

    it('raises the set’s lockVersion by one (response and store)', async () => {
      const { api, store } = ctx();
      const set = await createProblem(api, 'eva');
      const p = await createProblem(api, 'eva');
      const res = await add('eva', set.id, { lockVersion: 1, problemId: p.id }).expect(200);
      expect(res.body.lockVersion).toBe(2);
      await store.expectRecord('problems', set.id, { lockVersion: 2 });
    });

    it('the moved child takes the set’s status and, in a published set, the set’s licence', async () => {
      const { api, store } = ctx();
      const set = await createPublished(api, 'jan', seed.licenses.ccBy);
      const p = await createProblem(api, 'jan'); // PRIVATE, no licence
      await add('jan', set.id, { lockVersion: set.lockVersion, problemId: p.id }).expect(200);
      await store.expectRecord('problems', p.id, { publishStatus: 'PUBLISHED', parentId: store.toDbId(set.id), source: { licenseId: 2 } });
    });
  });

  describe('copy a problem in (copyFromId)', () => {
    it('creates a NEW record under the set, linked to the original; the original is unchanged', async () => {
      const { api, store } = ctx();
      const set = await createProblem(api, 'eva');
      const original = structuredClone(await store.expectRecord('problems', P.circle));
      const before = await store.countRecords('problems', undefined, { includeDeleted: true });

      const res = await add('eva', set.id, { lockVersion: 1, copyFromId: P.circle }).expect(200);

      expect(await store.countRecords('problems', undefined, { includeDeleted: true })).toBe(before + 1);
      const childId = res.body.children[0].id;
      expect(childId).not.toBe(P.circle);
      await store.expectRecord('problems', childId, {
        parentId: store.toDbId(set.id),
        authorId: users.eva.id,
        originalProblemId: original.id,
        originalProblemVersion: original.version,
        name: original.name,
      });
      expect(await store.expectRecord('problems', P.circle)).toEqual(original);
    });

    it('usual copy rules: foreign OWN → LICENSED_USE citing the author, licence inherited, only global tags', async () => {
      const { api, store } = ctx();
      const set = await createProblem(api, 'eva');
      const res = await add('eva', set.id, { lockVersion: 1, copyFromId: P.circle }).expect(200);
      expect(res.body.children[0].source).toMatchObject({ type: 'LICENSED_USE', citation: 'Převzato od: Jan Novák', license: { id: seed.licenses.ccBy } });
      await store.expectRecord('problems', res.body.children[0].id, { tagIds: [3], chapterIds: [3], source: { originType: 'LICENSED_USE', licenseId: 2 } });
    });

    it('your own published problem can be copied in (it is not moved)', async () => {
      const { api, store } = ctx();
      const set = await createProblem(api, 'jan');
      const res = await add('jan', set.id, { lockVersion: 1, copyFromId: P.circle }).expect(200);
      expect(res.body.children[0].id).not.toBe(P.circle);
      await store.expectRecord('problems', P.circle, { parentId: null, publishStatus: 'PUBLISHED' });
    });

    it('the copied child takes the set’s status (PRIVATE set → PRIVATE child)', async () => {
      const { api, store } = ctx();
      const set = await createProblem(api, 'eva');
      const res = await add('eva', set.id, { lockVersion: 1, copyFromId: P.circle }).expect(200);
      await store.expectRecord('problems', res.body.children[0].id, { publishStatus: 'PRIVATE' });
    });
  });

  describe('position (afterId)', () => {
    // Three children c1, c2, c3 in this order, built by appending (afterId missing = end).
    async function threeChildren() {
      const { api } = ctx();
      const { set, children } = await buildSet(api, 'eva', 3);
      return { set, children };
    }

    it('missing afterId → at the end', async () => {
      const { set, children } = await threeChildren();
      expect(ids(set.children)).toEqual(children);
      const p = await createProblem(ctx().api, 'eva');
      const res = await add('eva', set.id, { lockVersion: set.lockVersion, problemId: p.id }).expect(200);
      expect(ids(res.body.children)).toEqual([...children, p.id]);
    });

    it('afterId null → first', async () => {
      const { set, children } = await threeChildren();
      const p = await createProblem(ctx().api, 'eva');
      const res = await add('eva', set.id, { lockVersion: set.lockVersion, problemId: p.id, afterId: null }).expect(200);
      expect(ids(res.body.children)).toEqual([p.id, ...children]);
    });

    it('afterId = a child → right after that child (response and store order)', async () => {
      const { api, store } = ctx();
      const { set, children } = await threeChildren();
      const p = await createProblem(api, 'eva');
      const res = await add('eva', set.id, { lockVersion: set.lockVersion, problemId: p.id, afterId: children[0] }).expect(200);
      const expected = [children[0], p.id, children[1], children[2]];
      expect(ids(res.body.children)).toEqual(expected);
      expect((await store.children(set.id)).map((c) => c.id)).toEqual(expected.map((id) => store.toDbId(id)));
    });

    it('afterId = the last child → at the end', async () => {
      const { set, children } = await threeChildren();
      const res = await add('eva', set.id, { lockVersion: set.lockVersion, copyFromId: P.circle, afterId: children[2] }).expect(200);
      expect(ids(res.body.children).slice(0, 3)).toEqual(children);
      expect(res.body.children).toHaveLength(4);
    });

    it('the existing children keep their ids and records when one is inserted', async () => {
      const { api, store } = ctx();
      const { set, children } = await threeChildren();
      const p = await createProblem(api, 'eva');
      await add('eva', set.id, { lockVersion: set.lockVersion, problemId: p.id, afterId: null }).expect(200);
      for (const c of children) await store.expectRecord('problems', c, { parentId: store.toDbId(set.id) });
    });
  });

  describe('400 VALIDATION_FAILED, nothing changes', () => {
    it.each([
      ['both problemId and copyFromId', (p: string) => ({ problemId: p, copyFromId: seed.problems.circle })],
      ['neither problemId nor copyFromId', () => ({})],
      ['unknown afterId', (p: string) => ({ problemId: p, afterId: unknownId })],
      ['afterId that is not a child of this set', (p: string) => ({ problemId: p, afterId: seed.problems.circle })],
      ['problemId not found', () => ({ problemId: unknownId })],
      ['copyFromId not found', () => ({ copyFromId: unknownId })],
      ['copyFromId not visible (another teacher’s private problem)', () => ({ copyFromId: seed.problems.evaPrivate })],
      ['missing lockVersion', (p: string) => ({ lockVersion: undefined, problemId: p })],
    ])('%s', async (_, body) => {
      const { api, store } = ctx();
      const set = await createProblem(api, 'jan');
      const p = await createProblem(api, 'jan');
      const count = await store.countRecords('problems', undefined, { includeDeleted: true });
      expectError(await add('jan', set.id, { lockVersion: 1, ...body(p.id) }), 400, 'VALIDATION_FAILED');
      expect(await store.countRecords('problems', undefined, { includeDeleted: true })).toBe(count);
      await store.expectRecord('problems', set.id, { lockVersion: 1 });
      await store.expectRecord('problems', p.id, { parentId: null });
    });
  });

  describe('409, nothing changes', () => {
    it('LOCK_MISMATCH for a stale set lockVersion', async () => {
      const { api, store } = ctx();
      const set = await createProblem(api, 'eva');
      const p = await createProblem(api, 'eva');
      expectError(await add('eva', set.id, { lockVersion: 7, problemId: p.id }), 409, 'LOCK_MISMATCH');
      await store.expectRecord('problems', p.id, { parentId: null });
    });

    it('SET_PARENT_HAS_RESULT when the target still has a result', async () => {
      const { api, store } = ctx();
      const target = await createProblem(api, 'eva', { result: 'x = 1' });
      const p = await createProblem(api, 'eva');
      expectError(await add('eva', target.id, { lockVersion: 1, problemId: p.id }), 409, 'SET_PARENT_HAS_RESULT');
      await store.expectRecord('problems', p.id, { parentId: null });
    });

    it('IS_SET_CHILD when the target is itself a set child', async () => {
      const { api, store } = ctx();
      const p = await createProblem(api, 'jan');
      expectError(await add('jan', P.childA, { lockVersion: 1, problemId: p.id }), 409, 'IS_SET_CHILD');
      await store.expectRecord('problems', p.id, { parentId: null });
    });

    // Each case arranges its own target (a fresh standalone problem of `who`) and the request body.
    type Case = (target: string) => Promise<object>;
    const cases: [string, 'jan' | 'eva', Case][] = [
      ['move: the problem is already in a set', 'eva', async () => ({ problemId: (await buildSet(ctx().api, 'eva', 1)).children[0] })],
      ['move: the problem is a set', 'eva', async () => ({ problemId: (await buildSet(ctx().api, 'eva', 1)).set.id })],
      ['move: the problem is the target itself', 'eva', async (target) => ({ problemId: target })],
      ['move: not your problem (another teacher’s published problem)', 'eva', async () => ({ problemId: seed.problems.circle })],
      ['move: your own problem, but not PRIVATE', 'jan', async () => ({ problemId: (await createPublished(ctx().api, 'jan', seed.licenses.cc0)).id })],
      ['copy: the problem is a set', 'eva', async () => ({ copyFromId: (await buildSet(ctx().api, 'eva', 1)).set.id })],
      ['copy: the problem is the target itself', 'eva', async (target) => ({ copyFromId: target })],
    ];
    it.each(cases)('CANNOT_ADD_TO_SET: %s', async (_, who, arrange) => {
      const { api, store } = ctx();
      const target = await createProblem(api, who);
      const body = await arrange(target.id);
      const count = await store.countRecords('problems', undefined, { includeDeleted: true });
      expectError(await add(who, target.id, { lockVersion: 1, ...body }), 409, 'CANNOT_ADD_TO_SET');
      expect(await store.countRecords('problems', undefined, { includeDeleted: true })).toBe(count);
      await store.expectRecord('problems', target.id, { lockVersion: 1 });
      expect(await store.children(target.id)).toEqual([]);
    });

    it('LICENSE_REQUIRED: copying a problem whose licence forbids publication into a PUBLISHED set', async () => {
      const { api, store } = ctx();
      const set = await createPublished(api, 'jan', seed.licenses.ccBy);
      const count = await store.countRecords('problems');
      expectError(await add('jan', set.id, { lockVersion: set.lockVersion, copyFromId: P.textbook }), 409, 'LICENSE_REQUIRED');
      expect(await store.countRecords('problems')).toBe(count);
      expect(await store.children(set.id)).toEqual([]);
    });
  });

  describe('auth and ownership', () => {
    it('401 without a token', async () => {
      expectError(await ctx().api.post(`/problems/${P.set}/children`, { lockVersion: 3, copyFromId: P.circle }), 401, 'UNAUTHENTICATED');
    });

    it('403 FORBIDDEN on another teacher’s PUBLISHED problem; nothing changes', async () => {
      const { store } = ctx();
      const count = await store.countRecords('problems');
      expectError(await add('eva', P.circle, { lockVersion: 1, copyFromId: P.pythagoras }), 403, 'FORBIDDEN');
      expect(await store.countRecords('problems')).toBe(count);
    });

    it('404 NOT_FOUND on another teacher’s PRIVATE set', async () => {
      expectError(await add('eva', P.set, { lockVersion: 3, copyFromId: P.circle }), 404, 'NOT_FOUND');
    });

    it('404 NOT_FOUND for an unknown or malformed set id', async () => {
      expectError(await add('jan', unknownId, { lockVersion: 1, copyFromId: P.circle }), 404, 'NOT_FOUND');
      for (const bad of malformedIds) expectError(await add('jan', encodeURIComponent(bad), { lockVersion: 1, copyFromId: P.circle }), 404, 'NOT_FOUND');
    });

    it('petr (registered) may build his own private sets', async () => {
      const { api, store } = ctx();
      const { set, children } = await buildSet(api, 'petr', 2);
      expect(ids(set.children)).toEqual(children);
      await store.expectRecord('problems', set.id, { authorId: users.petr.id, publishStatus: 'PRIVATE' });
    });
  });
});
