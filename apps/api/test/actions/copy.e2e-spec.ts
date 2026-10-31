import { createTestApp, useTestApp } from '../support/app';
import { users } from '../support/auth';
import { expectError, ids, pickContent } from '../support/expect';
import { createProblem, getProblem } from '../support/factory';
import { malformedIds, seed, unknownId } from '../support/seed';

// copyProblem — POST /problems/{id}/copy
// Spec: anyone who can see the problem. New PRIVATE problem owned by the caller, linked to the
// original and its version. standalone → standalone; set → new set with copies of all children;
// child → standalone copy (original set unchanged). Source: OWN → LICENSED_USE citing the original
// author; LICENSED_USE / FREE_USE keep type and citation; licence always inherited.
// Tags/chapters: only global ones, unless the caller owns the original. Codes: 404.
// Not tested here (O-items):
//   O4: the source type when copying YOUR OWN OWN-problem (spec: LICENSED_USE, maybe should stay OWN).
//       Copies of one's own problems are tested for everything except `source.type` / citation.
// Not testable tonight: attachments pointing to the same stored images (Phase C, no attachments yet).
describe('copyProblem POST /problems/{id}/copy', () => {
  const ctx = useTestApp();
  const P = seed.problems;

  describe('a foreign published standalone problem', () => {
    it('creates a PRIVATE copy owned by the caller, linked to the original and its version', async () => {
      const { api, store } = ctx();
      const original = structuredClone(await store.expectRecord('problems', P.circle));
      const before = await store.countRecords('problems', undefined, { includeDeleted: true });

      const res = await api.as('eva').post(`/problems/${P.circle}/copy`).expect(201);

      expect(res.body.id).not.toBe(P.circle);
      expect(res.body).toMatchObject({
        ...pickContent({ name: original.name, assignment: original.assignment, result: original.result, language: original.languageCode, difficulty: original.difficulty }),
        author: { id: seed.users.eva, displayName: users.eva.displayName },
        status: 'PRIVATE',
        version: 1,
        lockVersion: 1,
        parentId: null,
        children: [],
        childCount: 0,
      });
      expect(await store.countRecords('problems', undefined, { includeDeleted: true })).toBe(before + 1);
      await store.expectRecord('problems', res.body.id, {
        authorId: users.eva.id,
        publishStatus: 'PRIVATE',
        version: 1,
        lockVersion: 1,
        parentId: null,
        originalProblemId: original.id,
        originalProblemVersion: original.version,
      });
    });

    it('source: OWN → LICENSED_USE citing the original author; the licence is inherited', async () => {
      const { api, store } = ctx();
      const res = await api.as('eva').post(`/problems/${P.circle}/copy`).expect(201);
      expect(res.body.source).toMatchObject({
        type: 'LICENSED_USE',
        citation: 'Převzato od: Jan Novák',
        license: { id: seed.licenses.ccBy, name: 'CC BY 4.0' },
      });
      await store.expectRecord('problems', res.body.id, { source: { originType: 'LICENSED_USE', licenseId: 2 } });
    });

    it('the original is unchanged (row deep-equal before and after)', async () => {
      const { api, store } = ctx();
      const before = structuredClone(await store.expectRecord('problems', P.pythagoras));
      await api.as('jan').post(`/problems/${P.pythagoras}/copy`).expect(201);
      expect(await store.expectRecord('problems', P.pythagoras)).toEqual(before);
    });

    it('a registered (unverified) teacher may copy too (petr)', async () => {
      const { api, store } = ctx();
      const res = await api.as('petr').post(`/problems/${P.pythagoras}/copy`).expect(201);
      await store.expectRecord('problems', res.body.id, { authorId: users.petr.id, publishStatus: 'PRIVATE', originalProblemId: 5 });
    });

    it('the copy is the caller’s: in their dashboard, editable by them, invisible to others', async () => {
      const { api } = ctx();
      const copy = (await api.as('eva').post(`/problems/${P.circle}/copy`).expect(201)).body;
      const mine = await api.as('eva').get('/problems?scope=mine&limit=100').expect(200);
      expect(ids(mine.body.items)).toContain(copy.id);
      await api.as('eva').patch(`/problems/${copy.id}`, { lockVersion: 1, name: 'Moje verze' }).expect(200);
      expectError(await api.as('jan').get(`/problems/${copy.id}`), 404, 'NOT_FOUND');
    });

    it('two copies are two independent records', async () => {
      const { api, store } = ctx();
      const a = (await api.as('eva').post(`/problems/${P.circle}/copy`).expect(201)).body;
      const b = (await api.as('eva').post(`/problems/${P.circle}/copy`).expect(201)).body;
      expect(a.id).not.toBe(b.id);
      await api.as('eva').patch(`/problems/${a.id}`, { lockVersion: 1, name: 'Jen A' }).expect(200);
      await store.expectRecord('problems', b.id, { name: 'Obsah kruhu' });
    });
  });

  describe('source of LICENSED_USE originals', () => {
    it('LICENSED_USE keeps its type, citation and licence', async () => {
      // The textbook problem is Jan's own, but its source is LICENSED_USE, so O4 (OWN on own copy) does not apply.
      const { api, store } = ctx();
      const res = await api.as('jan').post(`/problems/${P.textbook}/copy`).expect(201);
      expect(res.body.source).toMatchObject({ type: 'LICENSED_USE', citation: 'Učebnice Matematika 1, s. 42', license: { id: seed.licenses.allRightsReserved } });
      await store.expectRecord('problems', res.body.id, { source: { originType: 'LICENSED_USE', sourceCitationText: 'Učebnice Matematika 1, s. 42', licenseId: 4 } });
    });
  });

  describe('tags and chapters', () => {
    it('a foreign original: only global tags and chapters are copied', async () => {
      const fresh = await createTestApp();
      try {
        const { api, store } = fresh;
        // Jan's set has tags [1, 2, 4(personal)] and chapter 1. Publish it so eva can see it.
        await api.as('jan').post(`/problems/${P.set}/publish`, { licenseId: seed.licenses.ccBy }).expect(200);
        const res = await api.as('eva').post(`/problems/${P.set}/copy`).expect(201);
        expect(res.body.tags.map((t: { id: string }) => t.id)).toEqual([seed.tags.linear, seed.tags.quadratic]);
        await store.expectRecord('problems', res.body.id, { tagIds: [1, 2], chapterIds: [1] });
      } finally {
        await fresh.app.close();
      }
    });

    it('your own original: personal tags and chapters are kept too', async () => {
      const { api, store } = ctx();
      const p = await createProblem(api, 'jan', { tagIds: [seed.tags.janPersonal, seed.tags.linear], chapterIds: [seed.chapters.janPersonal] });
      const res = await api.as('jan').post(`/problems/${p.id}/copy`).expect(201);
      await store.expectRecord('problems', res.body.id, { tagIds: [4, 1], chapterIds: [4], originalProblemId: store.toDbId(p.id) });
    });
  });

  describe('a set', () => {
    const fresh = useTestApp();

    it('creates a new set with new copies of every child, in the same order; originals unchanged', async () => {
      const { api, store } = fresh();
      const originalRows = structuredClone([
        await store.expectRecord('problems', P.set),
        await store.expectRecord('problems', P.childA),
        await store.expectRecord('problems', P.childB),
      ]);
      const before = await store.countRecords('problems', undefined, { includeDeleted: true });

      const res = await api.as('jan').post(`/problems/${P.set}/copy`).expect(201);

      // 1 parent + 2 children, all new records.
      expect(await store.countRecords('problems', undefined, { includeDeleted: true })).toBe(before + 3);
      expect(res.body).toMatchObject({ childCount: 2, status: 'PRIVATE', version: 1, lockVersion: 1, parentId: null });
      const childIds = ids(res.body.children);
      expect(childIds).toHaveLength(2);
      expect(childIds).not.toContain(P.childA);
      expect(childIds).not.toContain(P.childB);
      expect(res.body.children.map((c: { name: string }) => c.name)).toEqual(['Rovnice a)', 'Rovnice b)']);

      // Store: new parent linked to the original set; each new child linked to its original child, under the new parent.
      const newSet = await store.expectRecord('problems', res.body.id, { authorId: 1, originalProblemId: 1, originalProblemVersion: 1, parentId: null });
      const kids = await store.children(res.body.id);
      expect(kids.map((k) => k.originalProblemId)).toEqual([2, 3]);
      for (const k of kids) expect(k).toMatchObject({ parentId: newSet.id, authorId: 1, publishStatus: 'PRIVATE' });

      // Originals untouched, and still the only children of the original set.
      expect([
        await store.expectRecord('problems', P.set),
        await store.expectRecord('problems', P.childA),
        await store.expectRecord('problems', P.childB),
      ]).toEqual(originalRows);
      expect((await store.children(P.set)).map((c) => c.id)).toEqual([2, 3]);
    });

    it('a set child → a standalone copy; the original set is not changed', async () => {
      const { api, store } = fresh();
      const setBefore = structuredClone(await store.expectRecord('problems', P.set));
      const res = await api.as('jan').post(`/problems/${P.childB}/copy`).expect(201);
      expect(res.body).toMatchObject({ parentId: null, childCount: 0, children: [], name: 'Rovnice b)' });
      await store.expectRecord('problems', res.body.id, { parentId: null, position: null, originalProblemId: 3 });
      expect(await store.expectRecord('problems', P.set)).toEqual(setBefore);
      expect((await store.children(P.set)).map((c) => c.id)).toEqual([2, 3]);
    });

    it('a foreign published set: children copies get the inherited licence and LICENSED_USE', async () => {
      const { api, store } = fresh();
      await api.as('jan').post(`/problems/${P.set}/publish`, { licenseId: seed.licenses.ccBy }).expect(200);
      const res = await api.as('eva').post(`/problems/${P.set}/copy`).expect(201);
      const kids = await store.children(res.body.id);
      expect(kids).toHaveLength(2);
      for (const k of kids) expect(k).toMatchObject({ authorId: 2, publishStatus: 'PRIVATE', source: { originType: 'LICENSED_USE', licenseId: 2 } });
      for (const c of res.body.children) expect(c.source).toMatchObject({ type: 'LICENSED_USE', citation: 'Převzato od: Jan Novák' });
    });
  });

  describe('not visible / not found: 404, nothing created', () => {
    it.each([
      ['another teacher’s private problem', () => seed.problems.evaPrivate],
      ['a child of another teacher’s private set', () => seed.problems.childA],
      ['an unknown id', () => unknownId],
      ...malformedIds.map((m) => [`malformed id "${m}"`, () => encodeURIComponent(m)] as [string, () => string]),
    ])('%s', async (_, id) => {
      const { api, store } = ctx();
      const before = await store.countRecords('problems', undefined, { includeDeleted: true });
      expectError(await api.as(id() === seed.problems.childA ? 'eva' : 'jan').post(`/problems/${id()}/copy`), 404, 'NOT_FOUND');
      expect(await store.countRecords('problems', undefined, { includeDeleted: true })).toBe(before);
    });

    it('a deleted problem cannot be copied', async () => {
      const { api } = ctx();
      const p = await createProblem(api, 'eva');
      await api.as('eva').delete(`/problems/${p.id}`).expect(204);
      expectError(await api.as('eva').post(`/problems/${p.id}/copy`), 404, 'NOT_FOUND');
    });
  });

  describe('auth', () => {
    it('401 UNAUTHENTICATED without a token; nothing created', async () => {
      const { api, store } = ctx();
      const before = await store.countRecords('problems');
      expectError(await api.post(`/problems/${P.circle}/copy`), 401, 'UNAUTHENTICATED');
      expect(await store.countRecords('problems')).toBe(before);
    });
  });

  describe('spec 2.0.0 fields', () => {
    it.skip('the copy shows originalId (the original’s id) to its author [R-008]', async () => {
      const res = await ctx().api.as('eva').post(`/problems/${P.circle}/copy`).expect(201);
      expect(res.body.originalId).toBe(P.circle);
      expect((await getProblem(ctx().api, 'eva', res.body.id)).originalId).toBe(P.circle);
    });

    it.skip('a fresh copy has updateAvailable false (author of a copy) [R-007]', async () => {
      const res = await ctx().api.as('eva').post(`/problems/${P.circle}/copy`).expect(201);
      expect(res.body.updateAvailable).toBe(false);
    });
  });
});
