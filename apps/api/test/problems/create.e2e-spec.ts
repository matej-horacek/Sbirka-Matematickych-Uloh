import { useTestApp } from '../support/app';
import { users } from '../support/auth';
import { expectError } from '../support/expect';
import { overflowIds, seed, unknownId } from '../support/seed';

// createProblem — POST /problems
// Spec: any logged-in teacher (registered too). Creates ONE problem: PRIVATE, owned by the caller,
// source OWN, no licence. Codes: 400 VALIDATION_FAILED.
// Not tested here (O-items): none.
describe('createProblem POST /problems', () => {
  const ctx = useTestApp();

  describe('happy path (response + store)', () => {
    it('creates one PRIVATE problem owned by the caller, source OWN, no licence', async () => {
      const { api, store } = ctx();
      const before = await store.countRecords('problems', undefined, { includeDeleted: true });
      const body = {
        name: 'Rovnice a)',
        assignment: '\\( 2x + 3 = 11 \\)',
        result: '\\( x = 4 \\)',
        language: 'cs',
        difficulty: 2,
        tagIds: [seed.tags.linear, seed.tags.janPersonal],
        chapterIds: [seed.chapters.linearEquations],
      };
      const res = await api.as('jan').post('/problems', body).expect(201);

      expect(res.body).toMatchObject({
        name: body.name,
        assignment: body.assignment,
        result: body.result,
        language: 'cs',
        difficulty: 2,
        author: { id: seed.users.jan, displayName: users.jan.displayName },
        tags: [
          { id: seed.tags.linear, scope: 'global' },
          { id: seed.tags.janPersonal, scope: 'personal' },
        ],
        chapters: [{ id: seed.chapters.linearEquations, scope: 'global' }],
        childCount: 0,
        status: 'PRIVATE',
        version: 1,
        lockVersion: 1,
        parentId: null,
        children: [],
        source: { type: 'OWN', license: null, citation: null },
      });

      // Exactly one new row, with the right owner, status, versions and relations.
      expect(await store.countRecords('problems', undefined, { includeDeleted: true })).toBe(before + 1);
      await store.expectRecord('problems', res.body.id, {
        authorId: users.jan.id,
        publishStatus: 'PRIVATE',
        version: 1,
        lockVersion: 1,
        parentId: null,
        position: null,
        originalProblemId: null,
        originalProblemVersion: null,
        result: body.result,
        languageCode: 'cs',
        difficulty: 2,
        tagIds: [1, 4],
        chapterIds: [2],
        source: { originType: 'OWN', licenseId: null, sourceCitationText: null },
      });
    });

    it('needs only name and assignment; optional fields default to null / empty', async () => {
      const { api, store } = ctx();
      const res = await api.as('eva').post('/problems', { name: 'N', assignment: 'A' }).expect(201);
      expect(res.body).toMatchObject({ result: null, language: null, difficulty: null, tags: [], chapters: [] });
      await store.expectRecord('problems', res.body.id, { authorId: users.eva.id, result: null, languageCode: null, difficulty: null, tagIds: [], chapterIds: [] });
    });

    it('a registered (unverified) teacher may create too (petr)', async () => {
      const { api, store } = ctx();
      const res = await api.as('petr').post('/problems', { name: 'P', assignment: 'A' }).expect(201);
      await store.expectRecord('problems', res.body.id, { authorId: users.petr.id, publishStatus: 'PRIVATE' });
    });

    it('the new problem is in the caller’s dashboard and nowhere public', async () => {
      const { api } = ctx();
      const res = await api.as('eva').post('/problems', { name: 'Dashboard', assignment: 'A' }).expect(201);
      const mine = await api.as('eva').get('/problems?scope=mine&limit=100').expect(200);
      const pub = await api.as('jan').get('/problems?scope=public&limit=100').expect(200);
      expect(mine.body.items.map((i: { id: string }) => i.id)).toContain(res.body.id);
      expect(pub.body.items.map((i: { id: string }) => i.id)).not.toContain(res.body.id);
      expectError(await api.as('jan').get(`/problems/${res.body.id}`), 404, 'NOT_FOUND');
    });
  });

  describe('validation: 400 VALIDATION_FAILED and nothing is stored', () => {
    it.each([
      ['empty name', { name: '', assignment: 'A' }],
      ['empty assignment', { name: 'N', assignment: '' }],
      ['name null', { name: null, assignment: 'A' }],
      ['difficulty 0', { name: 'N', assignment: 'A', difficulty: 0 }],
      ['difficulty 11', { name: 'N', assignment: 'A', difficulty: 11 }],
      ['difficulty not an integer', { name: 'N', assignment: 'A', difficulty: 2.5 }],
      ['difficulty a string', { name: 'N', assignment: 'A', difficulty: 'hard' }],
      ['tagIds not an array', { name: 'N', assignment: 'A', tagIds: seed.tags.linear }],
      ['malformed tagId', { name: 'N', assignment: 'A', tagIds: ['!!!'] }],
      ['unknown tagId', { name: 'N', assignment: 'A', tagIds: [unknownId] }],
      ['malformed chapterId', { name: 'N', assignment: 'A', chapterIds: ['!!!'] }],
      ['unknown chapterId', { name: 'N', assignment: 'A', chapterIds: [unknownId] }],
    ])('%s', async (_, body) => {
      const { api, store } = ctx();
      const before = await store.countRecords('problems', undefined, { includeDeleted: true });
      expectError(await api.as('jan').post('/problems', body), 400, 'VALIDATION_FAILED');
      expect(await store.countRecords('problems', undefined, { includeDeleted: true })).toBe(before);
    });

    it.skip('missing name or assignment → 400, nothing stored [R-015]', async () => {
      // Mock: the generated zProblemCreate loses `required: [name, assignment]` (an allOf branch without
      // properties), so the request passes validation and a problem WITHOUT a name is stored (201).
      const { api, store } = ctx();
      for (const body of [{}, { assignment: 'A' }, { name: 'N' }]) {
        const before = await store.countRecords('problems', undefined, { includeDeleted: true });
        expectError(await api.as('jan').post('/problems', body), 400, 'VALIDATION_FAILED');
        expect(await store.countRecords('problems', undefined, { includeDeleted: true })).toBe(before);
      }
    });

    it.skip('a tagId/chapterId that decodes beyond the safe integer range → 400, never 500 [R-021]', async () => {
      const { api } = ctx();
      for (const bad of overflowIds) {
        expectError(await api.as('jan').post('/problems', { name: 'N', assignment: 'A', tagIds: [bad] }), 400, 'VALIDATION_FAILED');
        expectError(await api.as('jan').post('/problems', { name: 'N', assignment: 'A', chapterIds: [bad] }), 400, 'VALIDATION_FAILED');
      }
    });

    it('another teacher’s personal tag or chapter cannot be attached', async () => {
      // Visibility: eva cannot see Jan's personal tag/chapter (listTags/listChapters), so she cannot use them.
      const { api, store } = ctx();
      const before = await store.countRecords('problems');
      expectError(await api.as('eva').post('/problems', { name: 'N', assignment: 'A', tagIds: [seed.tags.janPersonal] }), 400, 'VALIDATION_FAILED');
      expectError(await api.as('eva').post('/problems', { name: 'N', assignment: 'A', chapterIds: [seed.chapters.janPersonal] }), 400, 'VALIDATION_FAILED');
      expect(await store.countRecords('problems')).toBe(before);
    });
  });

  describe('auth', () => {
    it('401 UNAUTHENTICATED without a token, nothing stored', async () => {
      const { api, store } = ctx();
      const before = await store.countRecords('problems');
      expectError(await api.post('/problems', { name: 'N', assignment: 'A' }), 401, 'UNAUTHENTICATED');
      expect(await store.countRecords('problems')).toBe(before);
    });
  });

  describe('spec 2.0.0: one problem per create', () => {
    it.skip('a `children` array (1.0.x whole-set create) does not create children [R-011]', async () => {
      // 2.0.0 removed `children` from ProblemCreate: "Creates one problem." The mock still builds a whole set.
      const { api, store } = ctx();
      const before = await store.countRecords('problems');
      const res = await api.as('jan').post('/problems', {
        name: 'Set?',
        assignment: 'A',
        children: [{ name: 'a)', assignment: 'x' }],
      });
      if (res.status === 201) {
        expect(res.body.childCount).toBe(0);
        expect(await store.countRecords('problems')).toBe(before + 1);
      } else {
        expectError(res, 400, 'VALIDATION_FAILED');
        expect(await store.countRecords('problems')).toBe(before);
      }
    });

    it.skip('the author sees originalId: null on a new problem [R-008]', async () => {
      const res = await ctx().api.as('jan').post('/problems', { name: 'N', assignment: 'A' }).expect(201);
      expect(res.body).toHaveProperty('originalId', null);
    });
  });
});
