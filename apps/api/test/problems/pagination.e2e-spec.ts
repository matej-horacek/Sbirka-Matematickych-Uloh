import fc from 'fast-check';
import { useTestApp } from '../support/app';
import { ids } from '../support/expect';
import { createProblem } from '../support/factory';
import { seed } from '../support/seed';

// T8: pagination and filter edge cases on listProblems (and listTags), beyond list.e2e-spec.ts.
// Shared pagination (§6 Decided): page >= 1, 1 <= limit <= 100, meta { page, limit, total }.
// The spec states no sort order; these tests only need the order to be stable between requests.
describe('Pagination and filter edge cases (listProblems, listTags)', () => {
  const ctx = useTestApp();
  const N = 13; // Eva's problems after the arrange step: 2 from the seed + 11 new.

  beforeAll(async () => {
    const { api } = ctx();
    for (let i = 0; i < N - 2; i++) {
      await createProblem(api, 'eva', { tagIds: i % 2 ? [seed.tags.linear] : [seed.tags.geometry], language: i % 3 ? 'cs' : 'sk' });
    }
  });

  async function allPages(limit: number, query = 'scope=mine') {
    const { api } = ctx();
    const first = await api.as('eva').get(`/problems?${query}&limit=${limit}&page=1`).expect(200);
    const pages = [first.body];
    const count = Math.ceil(first.body.meta.total / limit);
    for (let page = 2; page <= count; page++) pages.push((await api.as('eva').get(`/problems?${query}&limit=${limit}&page=${page}`).expect(200)).body);
    return pages;
  }

  it('for any limit, the pages together contain every problem exactly once, and total is the same on every page', async () => {
    const full = await allPages(100);
    expect(full).toHaveLength(1);
    const everything = ids(full[0].items).sort();
    expect(everything).toHaveLength(N);

    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 14 }), async (limit) => {
        const pages = await allPages(limit);
        const seen = pages.flatMap((p) => ids(p.items));
        expect(seen.sort()).toEqual(everything);
        for (const [i, p] of pages.entries()) {
          expect(p.meta).toEqual({ page: i + 1, limit, total: N });
          expect(p.items.length).toBe(i < pages.length - 1 ? limit : N - limit * (pages.length - 1));
        }
      }),
      { numRuns: 15 },
    );
  });

  it('the last page holds the remainder; the page after it is empty with the real total', async () => {
    const { api } = ctx();
    const last = await api.as('eva').get('/problems?scope=mine&limit=5&page=3').expect(200);
    expect(last.body.items).toHaveLength(N - 10);
    const after = await api.as('eva').get('/problems?scope=mine&limit=5&page=4').expect(200);
    expect(after.body).toEqual({ items: [], meta: { page: 4, limit: 5, total: N } });
  });

  it('limit=1: meta.total is the full count (the badge pattern)', async () => {
    const res = await ctx().api.as('eva').get('/problems?scope=mine&limit=1').expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.meta.total).toBe(N);
  });

  it('maximum page size (100) returns everything in one page', async () => {
    const res = await ctx().api.as('eva').get('/problems?scope=mine&limit=100').expect(200);
    expect(res.body.items).toHaveLength(N);
  });

  it('filters and pagination combine: total counts the filtered set, pages split it', async () => {
    const filtered = (await ctx().api.as('eva').get(`/problems?scope=mine&tagId=${seed.tags.linear}&language=cs&limit=100`).expect(200)).body;
    expect(filtered.meta.total).toBeGreaterThan(0);
    expect(filtered.meta.total).toBeLessThan(N);
    const pages = await allPages(2, `scope=mine&tagId=${seed.tags.linear}&language=cs`);
    expect(pages.flatMap((p) => ids(p.items)).sort()).toEqual(ids(filtered.items).sort());
    for (const p of pages) expect(p.meta.total).toBe(filtered.meta.total);
  });

  it('a combined filter that matches nothing gives an empty first page with total 0', async () => {
    const res = await ctx().api.as('eva').get(`/problems?scope=mine&tagId=${seed.tags.quadratic}&language=sk`).expect(200);
    expect(res.body).toEqual({ items: [], meta: { page: 1, limit: 20, total: 0 } });
  });

  it('scope=public pagination never mixes in private problems', async () => {
    const pages = await allPages(1, 'scope=public');
    expect(pages.flatMap((p) => ids(p.items)).sort()).toEqual([seed.problems.circle, seed.problems.pythagoras].sort());
  });

  it('listTags: limit=1 walks all tags exactly once', async () => {
    const { api } = ctx();
    const seen: string[] = [];
    for (let page = 1; page <= 4; page++) {
      const res = await api.as('jan').get(`/tags?limit=1&page=${page}`).expect(200);
      expect(res.body.meta).toEqual({ page, limit: 1, total: 4 });
      seen.push(...ids(res.body.items));
    }
    expect(new Set(seen).size).toBe(4);
    expect((await api.as('jan').get('/tags?limit=1&page=5').expect(200)).body.items).toEqual([]);
  });
});
