import { encodeId } from '../../src/common/utils/ids.js';
import { useTestApp } from '../support/app.js';
import { seed, unknownId } from '../support/seed.js';

// Worksheet CRUD on the mock seed (src/database/mock-seed.ts). Every response is also checked
// against openapi.yaml by the test client. Items (/worksheets/{id}/items) are not built yet.
// useTestApp() shares one app per describe, so every test that changes data has its own describe.
const W = {
  /** Jan's "Lineární rovnice – opakování", difficulty 3, tag linear, chapter Rovnice. */
  linear: encodeId(1),
  /** Jan's "Planimetrie – test", no tags. */
  planimetry: encodeId(2),
  /** Eva's PRIVATE "Kvadratické rovnice". */
  evaPrivate: encodeId(3),
};

describe('worksheets: reads and rejected writes (shared app, seed untouched)', () => {
  const ctx = useTestApp();

  it('listWorksheets returns only the caller’s own worksheets', async () => {
    const res = await ctx().api.as('jan').get('/worksheets').expect(200);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.items.map((w: { id: string }) => w.id).sort()).toEqual([W.linear, W.planimetry].sort());
  });

  it('listWorksheets filters by tag', async () => {
    const res = await ctx().api.as('jan').get(`/worksheets?tagId=${seed.tags.linear}`).expect(200);
    expect(res.body.items.map((w: { id: string }) => w.id)).toEqual([W.linear]);
  });

  it('getWorksheet: the author sees version and lockVersion', async () => {
    const res = await ctx().api.as('jan').get(`/worksheets/${W.linear}`).expect(200);
    expect(res.body).toMatchObject({ name: 'Lineární rovnice – opakování', status: 'PRIVATE', lockVersion: 1, items: [] });
  });

  it('getWorksheet: someone else’s private worksheet or an unknown id is 404', async () => {
    await ctx().api.as('jan').get(`/worksheets/${W.evaPrivate}`).expect(404);
    await ctx().api.as('jan').get(`/worksheets/${unknownId}`).expect(404);
  });

  it('createWorksheet rejects an unknown tag (400)', async () => {
    await ctx().api.as('jan').post('/worksheets', { name: 'X', tagIds: [unknownId] }).expect(400);
  });

  it('updateWorksheet: a stale lockVersion is 409', async () => {
    await ctx().api.as('jan').patch(`/worksheets/${W.linear}`, { lockVersion: 7, name: 'X' }).expect(409);
  });

  it('deleteWorksheet on someone else’s private worksheet is 404', async () => {
    await ctx().api.as('jan').delete(`/worksheets/${W.evaPrivate}`).expect(404);
  });
});

describe('createWorksheet', () => {
  const ctx = useTestApp();

  it('creates an empty PRIVATE worksheet (201)', async () => {
    const { api } = ctx();
    const res = await api
      .as('jan')
      .post('/worksheets', { name: 'Nový list', language: 'cs', difficulty: 2, tagIds: [seed.tags.geometry] })
      .expect(201);
    expect(res.body).toMatchObject({ name: 'Nový list', status: 'PRIVATE', version: 1, lockVersion: 1, itemCount: 0 });
    await api.as('jan').get(`/worksheets/${res.body.id}`).expect(200);
  });
});

describe('updateWorksheet: name change', () => {
  const ctx = useTestApp();

  it('raises version and lockVersion', async () => {
    const res = await ctx().api.as('jan').patch(`/worksheets/${W.linear}`, { lockVersion: 1, name: 'Nové jméno' }).expect(200);
    expect(res.body).toMatchObject({ name: 'Nové jméno', version: 2, lockVersion: 2 });
  });
});

describe('updateWorksheet: tags only', () => {
  const ctx = useTestApp();

  it('raises lockVersion but not version (D-43)', async () => {
    const res = await ctx()
      .api.as('jan')
      .patch(`/worksheets/${W.linear}`, { lockVersion: 1, tagIds: [seed.tags.quadratic] })
      .expect(200);
    expect(res.body).toMatchObject({ version: 1, lockVersion: 2 });
  });
});

describe('deleteWorksheet', () => {
  const ctx = useTestApp();

  it('soft-deletes: then 404 and gone from the list', async () => {
    const { api } = ctx();
    await api.as('jan').delete(`/worksheets/${W.planimetry}`).expect(204);
    await api.as('jan').get(`/worksheets/${W.planimetry}`).expect(404);
    expect((await api.as('jan').get('/worksheets').expect(200)).body.meta.total).toBe(1);
  });
});
