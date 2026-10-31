import { useTestApp } from '../support/app';
import { expectError, ids, pickContent } from '../support/expect';
import { buildSet, createProblem, getProblem } from '../support/factory';
import { malformedIds, seed, unknownId } from '../support/seed';
import type { Api } from '../support/api';

// Copy updates (spec 2.0.0), NOT IN MOCK: every test is skipped.
//   updateAvailable field + filter on listProblems (R-007), takeOverUpdate (R-005), dismissUpdate (R-006).
// Decided (§6): updateAvailable is COMPUTED ON READ, not stored. It is "present only for the author of a copy
//   (on a set: only on the set itself, never on its children)"; true = the original has a newer version than
//   the one taken over, and it was not dismissed.
// Not tested here (O-items): O2, whether the original's edit also stores notification rows.
// Not asserted (unclear in the spec, see QUESTIONS.md): the copy's version / lockVersion after take-over (Q-005);
//   a copy whose original was deleted or unpublished (Q-007); updateAvailable on a non-copy (absent or false?).
// Not reachable through the API: take-over 202 (only trusted teachers reach PUBLISHED; they get 200).
//
// Arrange: Jan (trusted) owns the published original, so his PATCH applies (200) and raises its version.
// Eva copies it. A verified author's edit to a published problem is a 202 and changes nothing.
describe('Copy updates: updateAvailable, takeOverUpdate, dismissUpdate', () => {
  const ctx = useTestApp();
  const P = seed.problems;

  /** Jan's new published original + Eva's copy of it. */
  async function originalAndCopy(api: Api) {
    const created = await createProblem(api, 'jan', { result: 'r1', difficulty: 2, tagIds: [seed.tags.geometry] });
    const original = (await api.as('jan').post(`/problems/${created.id}/publish`, { licenseId: seed.licenses.ccBy }).expect(200)).body;
    const copy = (await api.as('eva').post(`/problems/${original.id}/copy`).expect(201)).body;
    return { original, copy };
  }

  /** Jan edits his original (trusted → applied, version + 1). */
  async function editOriginal(api: Api, id: string, fields: object) {
    const current = await getProblem(api, 'jan', id);
    return (await api.as('jan').patch(`/problems/${id}`, { lockVersion: current.lockVersion, ...fields }).expect(200)).body;
  }

  describe('updateAvailable on read [R-007 not in mock]', () => {
    it.skip('false on a fresh copy, true after the original gets a new version (detail and list) [R-007 not in mock]', async () => {
      const { api } = ctx();
      const { original, copy } = await originalAndCopy(api);
      expect((await getProblem(api, 'eva', copy.id)).updateAvailable).toBe(false);

      await editOriginal(api, original.id, { assignment: 'Nové zadání' });

      expect((await getProblem(api, 'eva', copy.id)).updateAvailable).toBe(true);
      const mine = await api.as('eva').get('/problems?scope=mine&limit=100').expect(200);
      expect(mine.body.items.find((i: { id: string }) => i.id === copy.id).updateAvailable).toBe(true);
    });

    it.skip('computed on read: the copy’s stored row is not touched by the original’s edit [R-007 not in mock]', async () => {
      const { api, store } = ctx();
      const { original, copy } = await originalAndCopy(api);
      const before = structuredClone(await store.expectRecord('problems', copy.id));
      await editOriginal(api, original.id, { name: 'Přejmenováno' });
      expect(await store.expectRecord('problems', copy.id)).toEqual(before);
      expect((await getProblem(api, 'eva', copy.id)).updateAvailable).toBe(true);
    });

    it.skip('editing the COPY does not make updateAvailable true [R-007 not in mock]', async () => {
      const { api } = ctx();
      const { copy } = await originalAndCopy(api);
      await api.as('eva').patch(`/problems/${copy.id}`, { lockVersion: copy.lockVersion, name: 'Moje' }).expect(200);
      expect((await getProblem(api, 'eva', copy.id)).updateAvailable).toBe(false);
    });

    it.skip('a 202 edit (non-trusted author of a published original) does not count as a new version [R-007 not in mock]', async () => {
      const { api } = ctx();
      // Eva's published Pythagoras; Jan copies it; Eva's edit goes to review (202) and changes nothing.
      const copy = (await api.as('jan').post(`/problems/${P.pythagoras}/copy`).expect(201)).body;
      const orig = await getProblem(api, 'eva', P.pythagoras);
      await api.as('eva').patch(`/problems/${P.pythagoras}`, { lockVersion: orig.lockVersion, name: 'K revizi' }).expect(202);
      expect((await getProblem(api, 'jan', copy.id)).updateAvailable).toBe(false);
    });

    it.skip('present only for the author of the copy: another teacher never sees it [R-007 not in mock]', async () => {
      const { api } = ctx();
      // Jan copies his own published original and publishes the copy, so Eva can see the copy.
      const created = await createProblem(api, 'jan');
      const original = (await api.as('jan').post(`/problems/${created.id}/publish`, { licenseId: seed.licenses.cc0 }).expect(200)).body;
      const copy = (await api.as('jan').post(`/problems/${original.id}/copy`).expect(201)).body;
      await api.as('jan').post(`/problems/${copy.id}/publish`).expect(200);
      await editOriginal(api, original.id, { name: 'v2' });

      expect((await getProblem(api, 'jan', copy.id)).updateAvailable).toBe(true);
      expect(await getProblem(api, 'eva', copy.id)).not.toHaveProperty('updateAvailable');
      const pub = await api.as('eva').get('/problems?scope=public&limit=100').expect(200);
      expect(pub.body.items.find((i: { id: string }) => i.id === copy.id)).not.toHaveProperty('updateAvailable');
    });

    it.skip('on a set: only on the set itself, never on its children [R-007 not in mock]', async () => {
      const { api } = ctx();
      // Jan publishes the seed set; Eva copies it; Jan renames the set (version + 1).
      await api.as('jan').post(`/problems/${P.set}/publish`, { licenseId: seed.licenses.ccBy }).expect(200);
      const copy = (await api.as('eva').post(`/problems/${P.set}/copy`).expect(201)).body;
      await editOriginal(api, P.set, { name: 'Řešte rovnice (v2)' });

      const detail = await getProblem(api, 'eva', copy.id);
      expect(detail.updateAvailable).toBe(true);
      for (const child of detail.children) expect(child).not.toHaveProperty('updateAvailable');
    });

    it.skip('a child edit in the original set raises the set’s version, so the set copy gets updateAvailable [R-007, R-009 not in mock]', async () => {
      const { api } = ctx();
      const { set, children } = await buildSet(api, 'jan', 1);
      await api.as('jan').post(`/problems/${set.id}/publish`, { licenseId: seed.licenses.ccBy }).expect(200);
      const copy = (await api.as('eva').post(`/problems/${set.id}/copy`).expect(201)).body;
      await editOriginal(api, children[0], { assignment: 'změna dítěte' });
      expect((await getProblem(api, 'eva', copy.id)).updateAvailable).toBe(true);
    });
  });

  describe('updateAvailable filter on listProblems [R-007 not in mock]', () => {
    it.skip('scope=mine&updateAvailable=true returns only my copies with an update [R-007 not in mock]', async () => {
      const { api } = ctx();
      const a = await originalAndCopy(api);
      const b = await originalAndCopy(api);
      await editOriginal(api, a.original.id, { name: 'a v2' });
      const res = await api.as('eva').get('/problems?scope=mine&updateAvailable=true&limit=100').expect(200);
      expect(ids(res.body.items)).toContain(a.copy.id);
      expect(ids(res.body.items)).not.toContain(b.copy.id);
      for (const item of res.body.items) expect(item.updateAvailable).toBe(true);
    });

    it.skip('with limit=1, meta.total is the badge count [R-007 not in mock]', async () => {
      const { api } = ctx();
      const before = (await api.as('eva').get('/problems?scope=mine&updateAvailable=true&limit=1').expect(200)).body.meta.total;
      // Two new copies, only one of them gets an update: an ignored filter would count both.
      const a = await originalAndCopy(api);
      await originalAndCopy(api);
      await editOriginal(api, a.original.id, { name: 'a v2' });
      const res = await api.as('eva').get('/problems?scope=mine&updateAvailable=true&limit=1').expect(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.meta.total).toBe(before + 1);
    });

    it.skip('updateAvailable with scope=public → 400 VALIDATION_FAILED [R-007 not in mock]', async () => {
      expectError(await ctx().api.as('eva').get('/problems?scope=public&updateAvailable=true'), 400, 'VALIDATION_FAILED');
    });
  });

  describe('takeOverUpdate POST /problems/{id}/take-over-update [R-005 not in mock]', () => {
    it.skip('replaces the copy’s content with the original’s current version; updateAvailable becomes false [R-005 not in mock]', async () => {
      const { api, store } = ctx();
      const { original, copy } = await originalAndCopy(api);
      const v2 = await editOriginal(api, original.id, { name: 'v2', assignment: 'zadání v2', result: null, language: 'sk', difficulty: 7 });

      const res = await api.as('eva').post(`/problems/${copy.id}/take-over-update`, { lockVersion: copy.lockVersion }).expect(200);

      expect(pickContent(res.body)).toEqual(pickContent(v2));
      expect(res.body.updateAvailable).toBe(false);
      expect(res.body.id).toBe(copy.id); // the same record, not a new copy
      await store.expectRecord('problems', copy.id, { name: 'v2', assignment: 'zadání v2', result: null, languageCode: 'sk', difficulty: 7, authorId: 2 });
      expect((await getProblem(api, 'eva', copy.id)).updateAvailable).toBe(false);
    });

    it.skip('overwrites the copy holder’s own edits [R-005 not in mock]', async () => {
      const { api } = ctx();
      const { original, copy } = await originalAndCopy(api);
      const edited = (await api.as('eva').patch(`/problems/${copy.id}`, { lockVersion: copy.lockVersion, assignment: 'moje úprava' }).expect(200)).body;
      await editOriginal(api, original.id, { name: 'v2' });
      const res = await api.as('eva').post(`/problems/${copy.id}/take-over-update`, { lockVersion: edited.lockVersion }).expect(200);
      expect(res.body.assignment).toBe(original.assignment);
      expect(res.body.name).toBe('v2');
    });

    it.skip('tags, chapters and the source stay as they are [R-005 not in mock]', async () => {
      const { api, store } = ctx();
      const { original, copy } = await originalAndCopy(api);
      const before = structuredClone(await store.expectRecord('problems', copy.id));
      await editOriginal(api, original.id, { name: 'v2', tagIds: [seed.tags.linear], chapterIds: [seed.chapters.planimetry] });
      await api.as('eva').post(`/problems/${copy.id}/take-over-update`, { lockVersion: copy.lockVersion }).expect(200);
      await store.expectRecord('problems', copy.id, { tagIds: before.tagIds, chapterIds: before.chapterIds, source: before.source });
    });

    it.skip('the original is unchanged by a take-over [R-005 not in mock]', async () => {
      const { api, store } = ctx();
      const { original, copy } = await originalAndCopy(api);
      await editOriginal(api, original.id, { name: 'v2' });
      const before = structuredClone(await store.expectRecord('problems', original.id));
      await api.as('eva').post(`/problems/${copy.id}/take-over-update`, { lockVersion: copy.lockVersion }).expect(200);
      expect(await store.expectRecord('problems', original.id)).toEqual(before);
    });

    it.skip('on a set: the children are replaced with fresh copies of the original’s children [R-005 not in mock]', async () => {
      const { api, store } = ctx();
      const fresh = await (async () => {
        const { set } = await buildSet(api, 'jan', 2);
        const pub = (await api.as('jan').post(`/problems/${set.id}/publish`, { licenseId: seed.licenses.ccBy }).expect(200)).body;
        const copy = (await api.as('eva').post(`/problems/${set.id}/copy`).expect(201)).body;
        return { set: pub, copy };
      })();
      const oldChildIds = ids(fresh.copy.children);
      await editOriginal(api, fresh.set.id, { name: 'sada v2' });
      const originalChildren = (await getProblem(api, 'jan', fresh.set.id)).children;

      const res = await api.as('eva').post(`/problems/${fresh.copy.id}/take-over-update`, { lockVersion: fresh.copy.lockVersion }).expect(200);

      expect(res.body.children.map(pickContent)).toEqual(originalChildren.map(pickContent));
      for (const c of res.body.children) expect(oldChildIds).not.toContain(c.id); // fresh copies
      const kids = await store.children(fresh.copy.id);
      expect(kids.map((k) => k.originalProblemId)).toEqual(originalChildren.map((c: { id: string }) => store.toDbId(c.id)));
      for (const k of kids) expect(k.authorId).toBe(2);
    });

    it.skip('409 LOCK_MISMATCH for a stale lockVersion; nothing changes [R-005 not in mock]', async () => {
      const { api, store } = ctx();
      const { original, copy } = await originalAndCopy(api);
      await editOriginal(api, original.id, { name: 'v2' });
      expectError(await api.as('eva').post(`/problems/${copy.id}/take-over-update`, { lockVersion: copy.lockVersion + 5 }), 409, 'LOCK_MISMATCH');
      await store.expectRecord('problems', copy.id, { name: copy.name });
    });

    it.skip('409 NO_UPDATE_AVAILABLE when there is no newer version [R-005 not in mock]', async () => {
      const { api } = ctx();
      const { copy } = await originalAndCopy(api);
      expectError(await api.as('eva').post(`/problems/${copy.id}/take-over-update`, { lockVersion: copy.lockVersion }), 409, 'NO_UPDATE_AVAILABLE');
    });

    it.skip('409 NO_UPDATE_AVAILABLE on a problem that is not a copy [R-005 not in mock]', async () => {
      const { api } = ctx();
      const p = await createProblem(api, 'eva');
      expectError(await api.as('eva').post(`/problems/${p.id}/take-over-update`, { lockVersion: 1 }), 409, 'NO_UPDATE_AVAILABLE');
    });

    it.skip('409 NO_UPDATE_AVAILABLE a second time (already taken over) [R-005 not in mock]', async () => {
      const { api } = ctx();
      const { original, copy } = await originalAndCopy(api);
      await editOriginal(api, original.id, { name: 'v2' });
      const r = await api.as('eva').post(`/problems/${copy.id}/take-over-update`, { lockVersion: copy.lockVersion }).expect(200);
      expectError(await api.as('eva').post(`/problems/${copy.id}/take-over-update`, { lockVersion: r.body.lockVersion }), 409, 'NO_UPDATE_AVAILABLE');
    });

    it.skip('409 IS_SET_CHILD on a set child [R-005 not in mock]', async () => {
      const { api } = ctx();
      const copy = (await api.as('jan').post(`/problems/${P.set}/copy`).expect(201)).body;
      expectError(await api.as('jan').post(`/problems/${copy.children[0].id}/take-over-update`, { lockVersion: 1 }), 409, 'IS_SET_CHILD');
    });

    it.skip('400 VALIDATION_FAILED without lockVersion [R-005 not in mock, SPEC_CHECK C-5]', async () => {
      // TakeOverRequest requires lockVersion, but the spec declares no 400 for takeOverUpdate (C-5). If the spec
      // keeps it that way, the contract check fails this test: that is the point (the spec should declare 400).
      const { api } = ctx();
      const { copy } = await originalAndCopy(api);
      expectError(await api.as('eva').post(`/problems/${copy.id}/take-over-update`, {}), 400, 'VALIDATION_FAILED');
    });

    it.skip('ownership: 404 on another teacher’s private copy, 403 on a published one [R-005 not in mock]', async () => {
      const { api } = ctx();
      const { copy } = await originalAndCopy(api);
      expectError(await api.as('jan').post(`/problems/${copy.id}/take-over-update`, { lockVersion: 1 }), 404, 'NOT_FOUND');
      expectError(await api.as('eva').post(`/problems/${P.circle}/take-over-update`, { lockVersion: 1 }), 403, 'FORBIDDEN');
    });

    it.skip('401 without a token; 404 for unknown or malformed ids [R-005 not in mock]', async () => {
      const { api } = ctx();
      expectError(await api.post(`/problems/${P.circle}/take-over-update`, { lockVersion: 1 }), 401, 'UNAUTHENTICATED');
      expectError(await api.as('eva').post(`/problems/${unknownId}/take-over-update`, { lockVersion: 1 }), 404, 'NOT_FOUND');
      for (const bad of malformedIds) {
        expectError(await api.as('eva').post(`/problems/${encodeURIComponent(bad)}/take-over-update`, { lockVersion: 1 }), 404, 'NOT_FOUND');
      }
    });
  });

  describe('dismissUpdate POST /problems/{id}/dismiss-update [R-006 not in mock]', () => {
    it.skip('updateAvailable becomes false; nothing else changes (content, version, lockVersion) [R-006 not in mock]', async () => {
      const { api } = ctx();
      const { original, copy } = await originalAndCopy(api);
      await editOriginal(api, original.id, { name: 'v2' });
      const before = await getProblem(api, 'eva', copy.id);

      const res = await api.as('eva').post(`/problems/${copy.id}/dismiss-update`).expect(200);

      expect(res.body.updateAvailable).toBe(false);
      expect(pickContent(res.body)).toEqual(pickContent(before));
      expect({ version: res.body.version, lockVersion: res.body.lockVersion }).toEqual({ version: before.version, lockVersion: before.lockVersion });
      const after = await getProblem(api, 'eva', copy.id);
      expect(after.updateAvailable).toBe(false);
      expect(after.name).toBe(copy.name); // not taken over
    });

    it.skip('the notice comes back when the original gets another new version [R-006 not in mock]', async () => {
      const { api } = ctx();
      const { original, copy } = await originalAndCopy(api);
      await editOriginal(api, original.id, { name: 'v2' });
      await api.as('eva').post(`/problems/${copy.id}/dismiss-update`).expect(200);
      await editOriginal(api, original.id, { name: 'v3' });
      expect((await getProblem(api, 'eva', copy.id)).updateAvailable).toBe(true);
    });

    it.skip('a dismissed copy leaves the updateAvailable=true list [R-006 not in mock]', async () => {
      const { api } = ctx();
      const { original, copy } = await originalAndCopy(api);
      await editOriginal(api, original.id, { name: 'v2' });
      await api.as('eva').post(`/problems/${copy.id}/dismiss-update`).expect(200);
      const res = await api.as('eva').get('/problems?scope=mine&updateAvailable=true&limit=100').expect(200);
      expect(ids(res.body.items)).not.toContain(copy.id);
    });

    it.skip('409 NO_UPDATE_AVAILABLE when there is nothing to dismiss, or on a non-copy [R-006 not in mock]', async () => {
      const { api } = ctx();
      const { copy } = await originalAndCopy(api);
      expectError(await api.as('eva').post(`/problems/${copy.id}/dismiss-update`), 409, 'NO_UPDATE_AVAILABLE');
      const p = await createProblem(api, 'eva');
      expectError(await api.as('eva').post(`/problems/${p.id}/dismiss-update`), 409, 'NO_UPDATE_AVAILABLE');
    });

    it.skip('ownership: 404 on another teacher’s private copy, 403 on a published one [R-006 not in mock]', async () => {
      const { api } = ctx();
      const { copy } = await originalAndCopy(api);
      expectError(await api.as('jan').post(`/problems/${copy.id}/dismiss-update`), 404, 'NOT_FOUND');
      expectError(await api.as('eva').post(`/problems/${P.circle}/dismiss-update`), 403, 'FORBIDDEN');
    });

    it.skip('401 without a token; 404 for unknown or malformed ids [R-006 not in mock]', async () => {
      const { api } = ctx();
      expectError(await api.post(`/problems/${P.circle}/dismiss-update`), 401, 'UNAUTHENTICATED');
      expectError(await api.as('eva').post(`/problems/${unknownId}/dismiss-update`), 404, 'NOT_FOUND');
      for (const bad of malformedIds) expectError(await api.as('eva').post(`/problems/${encodeURIComponent(bad)}/dismiss-update`), 404, 'NOT_FOUND');
    });
  });
});
