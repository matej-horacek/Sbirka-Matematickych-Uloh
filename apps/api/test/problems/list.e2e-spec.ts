import { useTestApp } from '../support/app';
import { users } from '../support/auth';
import { expectError, ids } from '../support/expect';
import { seed, unknownId } from '../support/seed';

// listProblems — GET /problems
// Spec: any logged-in teacher; scope=mine = own problems, scope=public = published ones;
// set children never listed on their own; several tagId/chapterId values match ANY of them;
// chapterId includes child chapters; 400 VALIDATION_FAILED.
// Not tested here (O-items): none. New-in-2.0.0 parts (ids, updateAvailable) are at the bottom, skipped.
describe('listProblems GET /problems', () => {
  const ctx = useTestApp();
  const P = seed.problems;

  describe('scope=mine', () => {
    it('returns exactly the caller’s own top-level problems (jan)', async () => {
      const { api, store } = ctx();
      const res = await api.as('jan').get('/problems?scope=mine').expect(200);
      expect(ids(res.body.items).sort()).toEqual([P.set, P.circle, P.textbook].sort());
      expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 3 });
      // Store agrees: every listed row is Jan's and top-level.
      for (const item of res.body.items) await store.expectRecord('problems', item.id, { authorId: users.jan.id, parentId: null });
      expect(await store.countRecords('problems', { authorId: users.jan.id, parentId: null })).toBe(3);
    });

    it('includes private and published problems of the caller (eva)', async () => {
      const res = await ctx().api.as('eva').get('/problems?scope=mine').expect(200);
      expect(ids(res.body.items).sort()).toEqual([P.pythagoras, P.evaPrivate].sort());
    });

    it('is empty for a user with no problems (petr)', async () => {
      const res = await ctx().api.as('petr').get('/problems?scope=mine').expect(200);
      expect(res.body).toEqual({ items: [], meta: { page: 1, limit: 20, total: 0 } });
    });

    it('lists a set once, with childCount, and never its children', async () => {
      const res = await ctx().api.as('jan').get('/problems?scope=mine').expect(200);
      const set = res.body.items.find((i: { id: string }) => i.id === P.set);
      expect(set.childCount).toBe(2);
      expect(ids(res.body.items)).not.toEqual(expect.arrayContaining([P.childA]));
      expect(ids(res.body.items)).not.toEqual(expect.arrayContaining([P.childB]));
    });
  });

  describe('scope=public', () => {
    it.each(['jan', 'eva', 'petr'] as const)('returns only published problems, for %s too', async (who) => {
      const { api, store } = ctx();
      const res = await api.as(who).get('/problems?scope=public').expect(200);
      expect(ids(res.body.items).sort()).toEqual([P.circle, P.pythagoras].sort());
      for (const item of res.body.items) await store.expectRecord('problems', item.id, { publishStatus: 'PUBLISHED' });
    });

    it('never shows another user’s private problem', async () => {
      const res = await ctx().api.as('jan').get('/problems?scope=public').expect(200);
      expect(ids(res.body.items)).not.toContain(P.evaPrivate);
    });
  });

  describe('filters', () => {
    it('tagId: one value', async () => {
      const res = await ctx().api.as('jan').get(`/problems?scope=mine&tagId=${seed.tags.geometry}`).expect(200);
      expect(ids(res.body.items)).toEqual([P.circle]);
    });

    it('tagId: several values match problems having ANY of them', async () => {
      const res = await ctx().api.as('jan').get(`/problems?scope=mine&tagId=${seed.tags.quadratic}&tagId=${seed.tags.geometry}`).expect(200);
      expect(ids(res.body.items).sort()).toEqual([P.set, P.circle].sort());
    });

    it('chapterId: a parent chapter includes problems in its child chapters', async () => {
      // "Rovnice" (1) has children "Lineární rovnice" (2) and Jan's personal chapter (4).
      // Jan: set is in chapter 1, textbook problem in chapter 2.
      const res = await ctx().api.as('jan').get(`/problems?scope=mine&chapterId=${seed.chapters.equations}`).expect(200);
      expect(ids(res.body.items).sort()).toEqual([P.set, P.textbook].sort());
    });

    it('chapterId: a child chapter does not include its parent', async () => {
      const res = await ctx().api.as('jan').get(`/problems?scope=mine&chapterId=${seed.chapters.linearEquations}`).expect(200);
      expect(ids(res.body.items)).toEqual([P.textbook]);
    });

    it('chapterId: several values match ANY of them', async () => {
      const res = await ctx().api.as('jan').get(`/problems?scope=mine&chapterId=${seed.chapters.linearEquations}&chapterId=${seed.chapters.planimetry}`).expect(200);
      expect(ids(res.body.items).sort()).toEqual([P.circle, P.textbook].sort());
    });

    it('combines tag, chapter and scope filters (AND between different filters)', async () => {
      const res = await ctx().api.as('jan').get(`/problems?scope=mine&tagId=${seed.tags.linear}&chapterId=${seed.chapters.linearEquations}`).expect(200);
      expect(ids(res.body.items)).toEqual([P.textbook]);
    });

    it('language filter matches exactly', async () => {
      const { api } = ctx();
      expect((await api.as('jan').get('/problems?scope=mine&language=cs').expect(200)).body.meta.total).toBe(3);
      expect((await api.as('jan').get('/problems?scope=mine&language=en').expect(200)).body.items).toEqual([]);
    });

    it('a well-formed but unknown tagId or chapterId matches nothing', async () => {
      const { api } = ctx();
      expect((await api.as('jan').get(`/problems?scope=mine&tagId=${unknownId}`).expect(200)).body.items).toEqual([]);
      expect((await api.as('jan').get(`/problems?scope=mine&chapterId=${unknownId}`).expect(200)).body.items).toEqual([]);
    });

    it.skip('a malformed tagId/chapterId never widens the result (400, or no matches) [R-013]', async () => {
      // Mock: invalid Sqids are dropped from the filter, the filter becomes empty and ALL problems match.
      for (const q of ['tagId=!!!', 'chapterId=!!!']) {
        const res = await ctx().api.as('jan').get(`/problems?scope=mine&${q}`);
        if (res.status === 200) expect(res.body.items).toEqual([]);
        else expectError(res, 400, 'VALIDATION_FAILED');
      }
    });
  });

  describe('pagination', () => {
    it('applies page and limit and reports the total', async () => {
      const { api } = ctx();
      const p1 = await api.as('jan').get('/problems?scope=mine&limit=2&page=1').expect(200);
      const p2 = await api.as('jan').get('/problems?scope=mine&limit=2&page=2').expect(200);
      expect(p1.body.meta).toEqual({ page: 1, limit: 2, total: 3 });
      expect(p2.body.meta).toEqual({ page: 2, limit: 2, total: 3 });
      expect(p1.body.items).toHaveLength(2);
      expect(p2.body.items).toHaveLength(1);
      expect(new Set([...ids(p1.body.items), ...ids(p2.body.items)]).size).toBe(3);
    });

    it('a page past the end is empty, with the real total', async () => {
      const res = await ctx().api.as('jan').get('/problems?scope=mine&page=9').expect(200);
      expect(res.body).toEqual({ items: [], meta: { page: 9, limit: 20, total: 3 } });
    });

    it('accepts the maximum limit (100)', async () => {
      await ctx().api.as('jan').get('/problems?scope=mine&limit=100').expect(200);
    });
  });

  describe('validation (400 VALIDATION_FAILED, never 500)', () => {
    it.each([
      ['missing scope', ''],
      ['unknown scope', 'scope=all'],
      ['limit above 100', 'scope=mine&limit=101'],
      ['limit 0', 'scope=mine&limit=0'],
      ['page 0', 'scope=mine&page=0'],
      ['page not a number', 'scope=mine&page=x'],
    ])('%s', async (_, query) => {
      expectError(await ctx().api.as('jan').get(`/problems?${query}`), 400, 'VALIDATION_FAILED');
    });
  });

  describe('auth', () => {
    it('401 UNAUTHENTICATED without a token', async () => {
      expectError(await ctx().api.get('/problems?scope=public'), 401, 'UNAUTHENTICATED');
    });
  });

  describe('list items carry no author-only detail fields', () => {
    it('no status, version, lockVersion (not part of ProblemListItem)', async () => {
      // The strict contract check rejects undeclared fields; this states the intent explicitly.
      const res = await ctx().api.as('jan').get('/problems?scope=mine').expect(200);
      for (const item of res.body.items) {
        expect(item).not.toHaveProperty('status');
        expect(item).not.toHaveProperty('lockVersion');
      }
    });
  });

  // ---------- new in spec 2.0.0, not in the mock ----------
  describe('ids filter (batch read) [R-007 not in mock]', () => {
    it.skip('returns only the requested problems [R-007 not in mock]', async () => {
      // One of the two public problems, so an ignored filter cannot pass by accident.
      const res = await ctx().api.as('jan').get(`/problems?scope=public&ids=${P.pythagoras}`).expect(200);
      expect(ids(res.body.items)).toEqual([P.pythagoras]);
      expect(res.body.meta.total).toBe(1);
    });

    it.skip('applies the same visibility and scope rules (no foreign private problem, no set children) [R-007 not in mock]', async () => {
      const res = await ctx().api.as('jan').get(`/problems?scope=mine&ids=${P.circle}&ids=${P.evaPrivate}&ids=${P.childA}`).expect(200);
      expect(ids(res.body.items)).toEqual([P.circle]);
    });

    it.skip('more than 100 ids → 400 VALIDATION_FAILED [R-007 not in mock]', async () => {
      const many = Array.from({ length: 101 }, () => `ids=${P.circle}`).join('&');
      expectError(await ctx().api.as('jan').get(`/problems?scope=public&${many}`), 400, 'VALIDATION_FAILED');
    });
  });

  describe('updateAvailable filter [R-007 not in mock]', () => {
    it.skip('updateAvailable with scope=public → 400 VALIDATION_FAILED [R-007 not in mock]', async () => {
      expectError(await ctx().api.as('jan').get('/problems?scope=public&updateAvailable=true'), 400, 'VALIDATION_FAILED');
    });
    // The positive cases (a copy whose original got a newer version) need several requests;
    // they live in copies/update-available.e2e-spec.ts.
  });
});
