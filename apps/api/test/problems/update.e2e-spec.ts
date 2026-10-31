import { useTestApp } from '../support/app';
import { expectError, pickContent } from '../support/expect';
import { buildSet, createProblem, createPublished, getProblem } from '../support/factory';
import { malformedIds, seed, unknownId } from '../support/seed';

// updateProblem — PATCH /problems/{id}
// Spec: author only, any problem including a set child, with the problem's own lockVersion.
// 200 applied (private, or trusted author); 202 when published (or in a published set) and the
// author is not trusted: "saved as a revision waiting for review, the returned problem is unchanged".
// The mock's 202 path stores nothing (TODO Phase B, B3): tested as "returned and stored problem unchanged".
// Non-author: 403 on published, 404 on private. 409 LOCK_MISMATCH, SET_PARENT_HAS_RESULT.
// Not tested here (O-items): O2, whether copy holders get stored notifications ("are notified").
//   Only the decided part (updateAvailable computed on read) is tested, in copies/update-available.e2e-spec.ts.
describe('updateProblem PATCH /problems/{id}', () => {
  const ctx = useTestApp();
  const P = seed.problems;

  describe('happy path (200, response + store)', () => {
    it('applies the change and raises version and lockVersion by one', async () => {
      const { api, store } = ctx();
      const p = await createProblem(api, 'eva', { result: 'r', difficulty: 3 });
      const res = await api.as('eva').patch(`/problems/${p.id}`, { lockVersion: 1, assignment: 'Nové zadání' }).expect(200);
      expect(res.body).toMatchObject({ id: p.id, assignment: 'Nové zadání', name: p.name, result: 'r', version: 2, lockVersion: 2, status: 'PRIVATE' });
      await store.expectRecord('problems', p.id, { assignment: 'Nové zadání', name: p.name, version: 2, lockVersion: 2, authorId: 2 });
    });

    it('a missing field stays unchanged, null clears a nullable field', async () => {
      const { api, store } = ctx();
      const p = await createProblem(api, 'jan', { result: 'r', language: 'cs', difficulty: 4 });
      const res = await api.as('jan').patch(`/problems/${p.id}`, { lockVersion: 1, result: null, language: null, difficulty: null }).expect(200);
      expect(res.body).toMatchObject({ name: p.name, assignment: p.assignment, result: null, language: null, difficulty: null });
      await store.expectRecord('problems', p.id, { name: p.name, assignment: p.assignment, result: null, languageCode: null, difficulty: null });
    });

    it('tagIds / chapterIds: missing = unchanged, sent = replaces the whole list', async () => {
      const { api, store } = ctx();
      const p = await createProblem(api, 'jan', { tagIds: [seed.tags.linear, seed.tags.quadratic], chapterIds: [seed.chapters.equations] });
      await api.as('jan').patch(`/problems/${p.id}`, { lockVersion: 1, name: 'Jiný název' }).expect(200);
      await store.expectRecord('problems', p.id, { tagIds: [1, 2], chapterIds: [1] });
      const res = await api.as('jan').patch(`/problems/${p.id}`, { lockVersion: 2, tagIds: [seed.tags.geometry], chapterIds: [] }).expect(200);
      expect(res.body.tags.map((t: { id: string }) => t.id)).toEqual([seed.tags.geometry]);
      expect(res.body.chapters).toEqual([]);
      await store.expectRecord('problems', p.id, { tagIds: [3], chapterIds: [] });
    });

    it('lockVersion only (no field changes) is accepted', async () => {
      const { api } = ctx();
      const p = await createProblem(api, 'jan');
      const res = await api.as('jan').patch(`/problems/${p.id}`, { lockVersion: 1 }).expect(200);
      expect(pickContent(res.body)).toEqual(pickContent(p));
    });

    it('a trusted author edits a PUBLISHED problem directly (200, stays PUBLISHED)', async () => {
      const { api, store } = ctx();
      const p = await createPublished(api, 'jan', seed.licenses.ccBy);
      expect(p.status).toBe('PUBLISHED');
      const res = await api.as('jan').patch(`/problems/${p.id}`, { lockVersion: p.lockVersion, name: 'Opraveno' }).expect(200);
      expect(res.body).toMatchObject({ name: 'Opraveno', status: 'PUBLISHED', version: p.version + 1, lockVersion: p.lockVersion + 1 });
      await store.expectRecord('problems', p.id, { name: 'Opraveno', publishStatus: 'PUBLISHED' });
    });
  });

  describe('202: published problem, author not trusted (review path, mock stores nothing yet)', () => {
    it('eva (verified) edits her PUBLISHED problem → 202, returned and stored problem unchanged', async () => {
      const { api, store } = ctx();
      const before = await getProblem(api, 'eva', P.pythagoras);
      const rowBefore = structuredClone(await store.expectRecord('problems', P.pythagoras));
      const res = await api.as('eva').patch(`/problems/${P.pythagoras}`, { lockVersion: before.lockVersion, name: 'Změna k revizi' }).expect(202);
      expect(res.body).toMatchObject({ name: before.name, version: before.version, lockVersion: before.lockVersion, status: 'PUBLISHED' });
      await store.expectRecord('problems', P.pythagoras, {
        name: rowBefore.name,
        version: rowBefore.version,
        lockVersion: rowBefore.lockVersion,
        publishStatus: 'PUBLISHED',
      });
    });
  });

  describe('409', () => {
    it('LOCK_MISMATCH for a stale lockVersion; nothing changes', async () => {
      const { api, store } = ctx();
      const p = await createProblem(api, 'jan');
      await api.as('jan').patch(`/problems/${p.id}`, { lockVersion: 1, name: 'First save' }).expect(200);
      expectError(await api.as('jan').patch(`/problems/${p.id}`, { lockVersion: 1, name: 'Second save' }), 409, 'LOCK_MISMATCH');
      await store.expectRecord('problems', p.id, { name: 'First save', lockVersion: 2, version: 2 });
    });

    it('SET_PARENT_HAS_RESULT when a result is put on a set; nothing changes', async () => {
      const { api, store } = ctx();
      expectError(await api.as('jan').patch(`/problems/${P.set}`, { lockVersion: 3, result: 'x = 1' }), 409, 'SET_PARENT_HAS_RESULT');
      await store.expectRecord('problems', P.set, { result: null, lockVersion: 3 });
    });
  });

  describe('validation (400 VALIDATION_FAILED, never 500)', () => {
    it.each([
      ['missing lockVersion', { name: 'N' }],
      ['lockVersion not an integer', { lockVersion: 'x' }],
      ['empty name', { lockVersion: 1, name: '' }],
      ['name null', { lockVersion: 1, name: null }],
      ['assignment null', { lockVersion: 1, assignment: null }],
      ['difficulty 11', { lockVersion: 1, difficulty: 11 }],
      ['malformed tagId', { lockVersion: 1, tagIds: ['!!!'] }],
      ['unknown chapterId', { lockVersion: 1, chapterIds: [unknownId] }],
      ['another teacher’s personal tag', { lockVersion: 1, tagIds: [seed.tags.janPersonal] }],
    ])('%s', async (_, body) => {
      const { api, store } = ctx();
      const p = await createProblem(api, 'eva');
      expectError(await api.as('eva').patch(`/problems/${p.id}`, body), 400, 'VALIDATION_FAILED');
      await store.expectRecord('problems', p.id, { name: p.name, lockVersion: 1, version: 1 });
    });
  });

  describe('auth and ownership', () => {
    it('401 UNAUTHENTICATED without a token', async () => {
      expectError(await ctx().api.patch(`/problems/${P.circle}`, { lockVersion: 1, name: 'x' }), 401, 'UNAUTHENTICATED');
    });

    it('403 FORBIDDEN for another teacher’s PUBLISHED problem; nothing changes', async () => {
      const { api, store } = ctx();
      expectError(await api.as('eva').patch(`/problems/${P.circle}`, { lockVersion: 1, name: 'Hijack' }), 403, 'FORBIDDEN');
      await store.expectRecord('problems', P.circle, { name: 'Obsah kruhu', authorId: 1 });
    });

    it('404 NOT_FOUND for another teacher’s PRIVATE problem; nothing changes', async () => {
      const { api, store } = ctx();
      expectError(await api.as('jan').patch(`/problems/${P.evaPrivate}`, { lockVersion: 1, name: 'Hijack' }), 404, 'NOT_FOUND');
      await store.expectRecord('problems', P.evaPrivate, { name: 'Soustava rovnic' });
    });

    it('404 NOT_FOUND for another teacher’s set child (private set)', async () => {
      expectError(await ctx().api.as('eva').patch(`/problems/${P.childA}`, { lockVersion: 1, name: 'x' }), 404, 'NOT_FOUND');
    });
  });

  describe('not found', () => {
    it('404 for an unknown id', async () => {
      expectError(await ctx().api.as('jan').patch(`/problems/${unknownId}`, { lockVersion: 1 }), 404, 'NOT_FOUND');
    });
    it.each(malformedIds)('404 (never 500) for the malformed id "%s"', async (bad) => {
      expectError(await ctx().api.as('jan').patch(`/problems/${encodeURIComponent(bad)}`, { lockVersion: 1 }), 404, 'NOT_FOUND');
    });
  });

  // ---------- spec 2.0.0: set children are edited directly ----------
  describe('editing a set child directly [R-009]', () => {
    // A pristine store: these tests change the seed set.
    const fresh = useTestApp();

    it.skip('the author edits a child with the child’s own lockVersion → 200, child updated [R-009]', async () => {
      const { api, store } = fresh();
      const res = await api.as('jan').patch(`/problems/${P.childA}`, { lockVersion: 1, assignment: '\\( 2x + 3 = 13 \\)' }).expect(200);
      expect(res.body).toMatchObject({ id: P.childA, parentId: P.set, assignment: '\\( 2x + 3 = 13 \\)', lockVersion: 2 });
      await store.expectRecord('problems', P.childA, { assignment: '\\( 2x + 3 = 13 \\)', lockVersion: 2, parentId: 1 });
    });

    it.skip('a child edit raises the set’s version but not the set’s lockVersion [R-009]', async () => {
      const { api, store } = fresh();
      const setBefore = await getProblem(api, 'jan', P.set);
      const child = setBefore.children.find((c: { id: string }) => c.id === P.childB);
      await api.as('jan').patch(`/problems/${P.childB}`, { lockVersion: child.lockVersion, name: 'Rovnice b) upravená' }).expect(200);
      const setAfter = await getProblem(api, 'jan', P.set);
      expect(setAfter.version).toBe(setBefore.version + 1);
      expect(setAfter.lockVersion).toBe(setBefore.lockVersion);
      await store.expectRecord('problems', P.set, { version: setBefore.version + 1, lockVersion: setBefore.lockVersion });
    });

    it.skip('the set’s lockVersion is NOT accepted for a child (each has its own) [R-009]', async () => {
      // Set lockVersion is 3, the child's is 1.
      expectError(await fresh().api.as('jan').patch(`/problems/${P.childA}`, { lockVersion: 3, name: 'x' }), 409, 'LOCK_MISMATCH');
    });

    it.skip('a result on a child is fine (only the set parent must not have one) [R-009]', async () => {
      const { api } = fresh();
      const set = await getProblem(api, 'jan', P.set);
      const child = set.children.find((c: { id: string }) => c.id === P.childA);
      await api.as('jan').patch(`/problems/${P.childA}`, { lockVersion: child.lockVersion, result: 'x = 4 (ověřeno)' }).expect(200);
    });

    it.skip('a new child moved into a set is editable with its own lockVersion [R-009, needs R-002]', async () => {
      const { api, store } = fresh();
      const { set, children } = await buildSet(api, 'eva', 1);
      const res = await api.as('eva').patch(`/problems/${children[0]}`, { lockVersion: 1, name: 'Upraveno' }).expect(200);
      expect(res.body).toMatchObject({ parentId: set.id, name: 'Upraveno', lockVersion: 2 });
      await store.expectRecord('problems', children[0], { name: 'Upraveno', lockVersion: 2 });
    });
    // Not testable through the API tonight: "202 for a child of a PUBLISHED set by a non-trusted author".
    // Only trusted teachers reach PUBLISHED (verified ones get REVIEWING), and a trusted author gets 200.
    // Phase B (admin approval) makes this reachable.
  });

  describe('another teacher and a child of a PUBLISHED set', () => {
    const fresh = useTestApp();

    it('403 FORBIDDEN, child unchanged', async () => {
      const { api, store } = fresh();
      await api.as('jan').post(`/problems/${P.set}/publish`, { licenseId: seed.licenses.ccBy }).expect(200);
      expectError(await api.as('eva').patch(`/problems/${P.childA}`, { lockVersion: 1, name: 'x' }), 403, 'FORBIDDEN');
      await store.expectRecord('problems', P.childA, { name: 'Rovnice a)', authorId: 1 });
    });
  });
});
