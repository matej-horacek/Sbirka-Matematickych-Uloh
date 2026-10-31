import { useTestApp } from './support/app';
import { seed } from './support/seed';

// T4.1: the baseline scenarios, ported. The runbook's "49 scenario checks" do not exist (Q-001);
// the only existing scenario artifact is apps/api/requests.http (11 requests, replayed at baseline
// by scripts/smoke/run-requests-http.mjs, which is kept). Same requests, same order, one shared app,
// now with contract validation and a store check each.
//
// Scenarios 4 and 5 are the 2.0.0 flow (create, add by move/copy, reorder, take out), see I7.
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

  // I7: scenarios 4 and 5 (1.0.x whole-set `children` body, removed in 2.0.0) are replaced by the
  // 2.0.0 flow of requests.http: create A, B and a set parent, add by move and by copy, reorder, take out.
  it('4-5. 2.0.0 flow: create, add (move + copy), reorder, take out', async () => {
    const { api, store } = ctx();
    const mk = async (body: object) => (await api.as('jan').post('/problems', body).expect(201)).body;
    const a = await mk({ name: 'Rovnice a)', assignment: '2x + 3 = 11', result: 'x = 4' });
    const b = await mk({ name: 'Rovnice b)', assignment: 'x^2 = 9' });
    const set = await mk({ name: 'Řešte rovnice', assignment: 'Vyřešte rovnice:', tagIds: [seed.tags.linear], chapterIds: [seed.chapters.equations] });

    let r = await api.as('jan').post(`/problems/${set.id}/children`, { lockVersion: set.lockVersion, problemId: a.id }).expect(200);
    r = await api.as('jan').post(`/problems/${set.id}/children`, { lockVersion: r.body.lockVersion, copyFromId: P.pythagoras, afterId: null }).expect(200);
    const copyId = r.body.children[0].id;
    r = await api.as('jan').post(`/problems/${set.id}/children`, { lockVersion: r.body.lockVersion, problemId: b.id, afterId: a.id }).expect(200);
    expect(r.body.children.map((c: { id: string }) => c.id)).toEqual([copyId, a.id, b.id]);

    r = await api.as('jan').patch(`/problems/${set.id}/children/${copyId}`, { lockVersion: r.body.lockVersion, afterId: b.id }).expect(200);
    expect(r.body.children.map((c: { id: string }) => c.id)).toEqual([a.id, b.id, copyId]);

    r = await api.as('jan').delete(`/problems/${set.id}/children/${a.id}`).set('If-Match', `"${r.body.lockVersion}"`).expect(200);
    expect(r.body.children.map((c: { id: string }) => c.id)).toEqual([b.id, copyId]);
    await store.expectRecord('problems', a.id, { parentId: null, publishStatus: 'PRIVATE' });
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
