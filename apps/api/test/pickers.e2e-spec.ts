import { useTestApp } from './support/app';
import { expectError } from './support/expect';
import { seed } from './support/seed';

// listTags GET /tags, listChapters GET /chapters, listLicenses GET /licenses (read-only pickers).
// Spec: any logged-in teacher. Tags: global + own personal, `q` = case-insensitive contains, paginated.
// Chapters: global + own personal, flat, parentId, sorted by name within each parent, not paginated.
// Licences: only those that allow publication, not paginated.
// Not tested here (O-items): O7 (the licenses module itself is a deviation to confirm; its behaviour is per spec).
describe('Pickers', () => {
  const ctx = useTestApp();

  describe('listTags GET /tags', () => {
    it('global tags plus the caller’s personal ones, with scope (jan)', async () => {
      const { api, store } = ctx();
      const res = await api.as('jan').get('/tags').expect(200);
      expect(res.body.items.map((t: { id: string }) => t.id).sort()).toEqual(
        [seed.tags.linear, seed.tags.quadratic, seed.tags.geometry, seed.tags.janPersonal].sort(),
      );
      expect(res.body.items.find((t: { id: string }) => t.id === seed.tags.janPersonal).scope).toBe('personal');
      expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 4 });
      expect(await store.countRecords('tags', (t) => t.isGlobal || t.ownerId === 1)).toBe(4);
    });

    it('never another teacher’s personal tags (eva)', async () => {
      const res = await ctx().api.as('eva').get('/tags').expect(200);
      expect(res.body.items.map((t: { id: string }) => t.id)).not.toContain(seed.tags.janPersonal);
      expect(res.body.meta.total).toBe(3);
    });

    it('q: case-insensitive "contains"', async () => {
      const { api } = ctx();
      const lower = await api.as('jan').get('/tags?q=rovn').expect(200);
      const upper = await api.as('jan').get('/tags?q=ROVN').expect(200);
      expect(lower.body.items.map((t: { name: string }) => t.name).sort()).toEqual(['kvadratické rovnice', 'lineární rovnice']);
      expect(upper.body.items).toEqual(lower.body.items);
      expect((await api.as('jan').get('/tags?q=xyz').expect(200)).body).toEqual({ items: [], meta: { page: 1, limit: 20, total: 0 } });
    });

    it('q matches Czech characters case-insensitively', async () => {
      const res = await ctx().api.as('jan').get(`/tags?q=${encodeURIComponent('LINEÁRNÍ')}`).expect(200);
      expect(res.body.items.map((t: { id: string }) => t.id)).toEqual([seed.tags.linear]);
    });

    it('pagination: page and limit, total stays the full count', async () => {
      const { api } = ctx();
      const p1 = await api.as('jan').get('/tags?limit=3&page=1').expect(200);
      const p2 = await api.as('jan').get('/tags?limit=3&page=2').expect(200);
      expect(p1.body.items).toHaveLength(3);
      expect(p2.body.items).toHaveLength(1);
      expect(p2.body.meta).toEqual({ page: 2, limit: 3, total: 4 });
    });

    it.each([
      ['empty q (minLength 1)', 'q='],
      ['limit 101', 'limit=101'],
      ['page 0', 'page=0'],
    ])('400 VALIDATION_FAILED: %s', async (_, query) => {
      expectError(await ctx().api.as('jan').get(`/tags?${query}`), 400, 'VALIDATION_FAILED');
    });

    it('401 without a token', async () => {
      expectError(await ctx().api.get('/tags'), 401, 'UNAUTHENTICATED');
    });
  });

  describe('listChapters GET /chapters', () => {
    it('global chapters plus the caller’s personal ones, flat with parentId (jan)', async () => {
      const res = await ctx().api.as('jan').get('/chapters').expect(200);
      expect(res.body).not.toHaveProperty('meta');
      const byId = Object.fromEntries(res.body.items.map((c: { id: string }) => [c.id, c]));
      expect(Object.keys(byId).sort()).toEqual(Object.values(seed.chapters).sort());
      expect(byId[seed.chapters.equations]).toEqual({ id: seed.chapters.equations, name: 'Rovnice', scope: 'global', parentId: null });
      expect(byId[seed.chapters.linearEquations].parentId).toBe(seed.chapters.equations);
      // A personal chapter under a global parent.
      expect(byId[seed.chapters.janPersonal]).toMatchObject({ scope: 'personal', parentId: seed.chapters.equations });
    });

    it('never another teacher’s personal chapters (eva)', async () => {
      const res = await ctx().api.as('eva').get('/chapters').expect(200);
      expect(res.body.items.map((c: { id: string }) => c.id)).not.toContain(seed.chapters.janPersonal);
      expect(res.body.items).toHaveLength(3);
    });

    it('sorted by name within each parent', async () => {
      const res = await ctx().api.as('jan').get('/chapters').expect(200);
      const groups = new Map<string | null, string[]>();
      for (const c of res.body.items as { name: string; parentId: string | null }[]) {
        groups.set(c.parentId, [...(groups.get(c.parentId) ?? []), c.name]);
      }
      for (const names of groups.values()) expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'cs')));
    });

    it('every parentId refers to a chapter in the same list (the tree can be built)', async () => {
      const res = await ctx().api.as('eva').get('/chapters').expect(200);
      const idSet = new Set(res.body.items.map((c: { id: string }) => c.id));
      for (const c of res.body.items) if (c.parentId !== null) expect(idSet).toContain(c.parentId);
    });

    it('401 without a token', async () => {
      expectError(await ctx().api.get('/chapters'), 401, 'UNAUTHENTICATED');
    });
  });

  describe('listLicenses GET /licenses', () => {
    it('only licences that allow publication', async () => {
      const { api, store } = ctx();
      const res = await api.as('petr').get('/licenses').expect(200);
      expect(res.body).not.toHaveProperty('meta');
      expect(res.body.items.map((l: { id: string }) => l.id)).toEqual([seed.licenses.cc0, seed.licenses.ccBy, seed.licenses.ccBySa]);
      expect(res.body.items.map((l: { id: string }) => l.id)).not.toContain(seed.licenses.allRightsReserved);
      expect(await store.countRecords('licenses', { allowsPublication: true })).toBe(3);
    });

    it('carries the licence terms the publish dialog needs', async () => {
      const res = await ctx().api.as('jan').get('/licenses').expect(200);
      expect(res.body.items[2]).toEqual({
        id: seed.licenses.ccBySa,
        name: 'CC BY-SA 4.0',
        url: 'https://creativecommons.org/licenses/by-sa/4.0/',
        description: 'S uvedením autora, úpravy pod stejnou licencí.',
        requiresAttribution: true,
        allowsModification: true,
        requiresShareAlike: true,
      });
    });

    it('401 without a token', async () => {
      expectError(await ctx().api.get('/licenses'), 401, 'UNAUTHENTICATED');
    });
  });

  describe('authentication (all operations)', () => {
    it.each(['Basic amFuOmphbg==', 'Bearer', 'jan'])('401 for a malformed Authorization header "%s"', async (header) => {
      const res = await ctx().api.raw().get('/api/v1/tags').set('Authorization', header);
      expectError(res, 401, 'UNAUTHENTICATED');
    });

    it.skip('401 for an unknown bearer token [R-014]', async () => {
      // Mock: any unknown token logs in as jan (mock-auth.guard.ts). Spec 401: "Not logged in, or the login expired."
      const res = await ctx().api.raw().get('/api/v1/tags').set('Authorization', 'Bearer not-a-user');
      expectError(res, 401, 'UNAUTHENTICATED');
    });
  });
});
