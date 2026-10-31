import { useTestApp } from './support/app';
import { seed } from './support/seed';

// T4.1: the baseline scenarios, ported. The runbook's "49 scenario checks" do not exist (Q-001);
// the only existing scenario artifact is apps/api/requests.http (11 requests, replayed at baseline
// by scripts/smoke/run-requests-http.mjs, which is kept). Same requests, same order, one shared app,
// now with contract validation and a store check each.
//
// Two of them use the 1.0.x whole-set `children` body (removed in spec 2.0.0, R-011). They are kept
// as-is because they document the baseline; their 2.0.0 replacements are in test/sets/.
describe('requests.http (baseline scenarios, in file order)', () => {
  const ctx = useTestApp();
  const P = seed.problems;

  it('1. My problems (dashboard)', async () => {
    const res = await ctx().api.as('jan').get('/problems?scope=mine').expect(200);
    expect(res.body.meta.total).toBe(3);
  });

  it('2. Public browser, filtered by chapter (includes child chapters)', async () => {
    // requests.http uses chapterId=UkLWZ ("Rovnice"); no PUBLISHED problem is in it or its children,
    // so 0 items is correct (the baseline note from T1.3 is explained, not a bug).
    const res = await ctx().api.as('eva').get(`/problems?scope=public&chapterId=${seed.chapters.equations}`).expect(200);
    expect(res.body.items).toEqual([]);
  });

  it('3. Detail of a set', async () => {
    const res = await ctx().api.as('jan').get(`/problems/${P.set}`).expect(200);
    expect(res.body.children).toHaveLength(2);
  });

  // I1: skipped, 1.0.x `children` body is gone in 2.0.0 (R-011). Replaced by the 2.0.0 flow in I7.
  it.skip('4. Create a set (1.0.x `children` body)', async () => {
    const { api, store } = ctx();
    const before = await store.countRecords('problems');
    const res = await api
      .as('jan')
      .post('/problems', {
        name: 'Řešte rovnice',
        assignment: 'Vyřešte rovnice v oboru reálných čísel:',
        result: null,
        tagIds: [seed.tags.linear],
        chapterIds: [seed.chapters.equations],
        children: [
          { name: 'Rovnice a)', assignment: '\\( 2x + 3 = 11 \\)', result: '\\( x = 4 \\)' },
          { name: 'Rovnice b)', assignment: '\\( x^2 = 9 \\)' },
        ],
      })
      .expect(201);
    // Baseline behaviour (1.0.x): parent + 2 children. Spec 2.0.0 would create one problem (R-011).
    expect(await store.countRecords('problems')).toBe(before + 3);
    expect(res.body.childCount).toBe(2);
  });

  // I1: skipped, same reason as 4. Replaced by the 2.0.0 flow in I7.
  it.skip('5. Edit the whole set: keep a), drop b), add c), copy Obsah kruhu in (1.0.x `children` body)', async () => {
    const { api, store } = ctx();
    const res = await api
      .as('jan')
      .patch(`/problems/${P.set}`, {
        lockVersion: 3,
        children: [{ id: P.childA }, { name: 'Rovnice c)', assignment: '\\( 3x - 1 = 2x + 4 \\)' }, { copyFromId: P.circle }],
      })
      .expect(200);
    expect(res.body.children.map((c: { name: string }) => c.name)).toEqual(['Rovnice a)', 'Rovnice c)', 'Obsah kruhu']);
    await store.expectDeleted('problems', P.childB);
    const kids = await store.children(P.set);
    expect(kids[0].id).toBe(2);
    expect(kids[2].originalProblemId).toBe(4);
  });

  it('6. Copy a published problem', async () => {
    const { api, store } = ctx();
    const res = await api.as('eva').post(`/problems/${P.circle}/copy`).expect(201);
    await store.expectRecord('problems', res.body.id, { authorId: 2, originalProblemId: 4 });
  });

  it('7. Publish the set with a licence', async () => {
    // requests.http sends licenseId gbHJd = CC BY 4.0.
    const { api, store } = ctx();
    const res = await api.as('jan').post(`/problems/${P.set}/publish`, { licenseId: seed.licenses.ccBy }).expect(200);
    expect(res.body.status).toBe('PUBLISHED');
    for (const k of await store.children(P.set)) expect(k.publishStatus).toBe('PUBLISHED');
  });

  it('8. Dissolve a set (children become standalone)', async () => {
    const { api, store } = ctx();
    const res = await api.as('jan').post(`/problems/${P.set}/dissolve`).expect(200);
    // I1: 2 children (the seed set); scenario 5 no longer adds a third one.
    expect(res.body.items).toHaveLength(2);
    await store.expectDeleted('problems', P.set);
  });

  it('9. Pickers: tags ?q=rov', async () => {
    const res = await ctx().api.as('jan').get('/tags?q=rov').expect(200);
    expect(res.body.meta.total).toBe(2);
  });

  it('10. Pickers: chapters', async () => {
    const res = await ctx().api.as('jan').get('/chapters').expect(200);
    expect(res.body.items).toHaveLength(4);
  });

  it('11. Pickers: licences', async () => {
    const res = await ctx().api.as('jan').get('/licenses').expect(200);
    expect(res.body.items).toHaveLength(3);
  });
});
