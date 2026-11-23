import { encodeId } from '../../src/common/utils/ids.js';
import { useTestApp } from '../support/app.js';
import { expectError } from '../support/expect.js';
import { seed, unknownId } from '../support/seed.js';

const P = seed.problems;
/** The problem ids of a WorksheetDetail's items, in worksheet order. */
const itemIds = (body: { items: { problem: { id: string } }[] }) => body.items.map((i) => i.problem.id);

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

  it('getWorksheet: the author sees version and lockVersion, and the items in order', async () => {
    const res = await ctx().api.as('jan').get(`/worksheets/${W.linear}`).expect(200);
    expect(res.body).toMatchObject({ name: 'Lineární rovnice – opakování', status: 'PRIVATE', lockVersion: 1, itemCount: 2 });
    expect(itemIds(res.body)).toEqual([P.set, P.circle]);
  });

  it('listWorksheets: itemCount counts the items', async () => {
    const res = await ctx().api.as('jan').get('/worksheets').expect(200);
    const count = (id: string) => res.body.items.find((w: { id: string }) => w.id === id).itemCount;
    expect([count(W.linear), count(W.planimetry)]).toEqual([2, 0]);
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

// ---------- items ----------
// Jan's "linear" worksheet holds [set (1), circle (4)], lockVersion 1, version 1.

describe('worksheet items: rejected requests (shared app, nothing changes)', () => {
  const ctx = useTestApp();
  const add = (body: object) => ctx().api.as('jan').post(`/worksheets/${W.linear}/items`, body);

  it('add: an own problem already in the worksheet is 409 ALREADY_IN_WORKSHEET', async () => {
    expectError(await add({ lockVersion: 1, problemId: P.set }), 409, 'ALREADY_IN_WORKSHEET');
  });

  it('add: a set child is 409 IS_SET_CHILD', async () => {
    expectError(await add({ lockVersion: 1, problemId: P.childA }), 409, 'IS_SET_CHILD');
  });

  it('add: a problem the caller cannot see is 404', async () => {
    expectError(await add({ lockVersion: 1, problemId: P.evaPrivate }), 404, 'NOT_FOUND');
  });

  it('add: a stale lockVersion is 409 LOCK_MISMATCH', async () => {
    expectError(await add({ lockVersion: 7, problemId: P.textbook }), 409, 'LOCK_MISMATCH');
  });

  it('add: an afterId that is not an item is 400', async () => {
    expectError(await add({ lockVersion: 1, problemId: P.textbook, afterId: P.textbook }), 400, 'VALIDATION_FAILED');
  });

  it('reorder: afterId equal to the item itself is 400, an item not in the worksheet is 404', async () => {
    const { api } = ctx();
    const res = await api.as('jan').patch(`/worksheets/${W.linear}/items/${P.circle}`, { lockVersion: 1, afterId: P.circle });
    expectError(res, 400, 'VALIDATION_FAILED');
    const missing = await api.as('jan').patch(`/worksheets/${W.linear}/items/${P.textbook}`, { lockVersion: 1, afterId: null });
    expectError(missing, 404, 'NOT_FOUND');
  });

  it('remove: a missing If-Match is 400, a stale one is 412 LOCK_MISMATCH', async () => {
    const { api } = ctx();
    expectError(await api.as('jan').delete(`/worksheets/${W.linear}/items/${P.circle}`), 400, 'VALIDATION_FAILED');
    const stale = await api.as('jan').delete(`/worksheets/${W.linear}/items/${P.circle}`).set('If-Match', '"7"');
    expectError(stale, 412, 'LOCK_MISMATCH');
  });

  it('nothing above changed the worksheet', async () => {
    const res = await ctx().api.as('jan').get(`/worksheets/${W.linear}`).expect(200);
    expect(res.body).toMatchObject({ lockVersion: 1, version: 1 });
    expect(itemIds(res.body)).toEqual([P.set, P.circle]);
  });
});

describe('addWorksheetItem: an own problem at the end', () => {
  const ctx = useTestApp();

  it('adds it as a reference and raises version and lockVersion', async () => {
    const res = await ctx().api.as('jan').post(`/worksheets/${W.linear}/items`, { lockVersion: 1, problemId: P.textbook }).expect(200);
    expect(res.body).toMatchObject({ itemCount: 3, version: 2, lockVersion: 2 });
    expect(itemIds(res.body)).toEqual([P.set, P.circle, P.textbook]); // the same id: a reference, no copy
  });
});

describe('addWorksheetItem: afterId null', () => {
  const ctx = useTestApp();

  it('puts it first', async () => {
    const res = await ctx()
      .api.as('jan')
      .post(`/worksheets/${W.linear}/items`, { lockVersion: 1, problemId: P.textbook, afterId: null })
      .expect(200);
    expect(itemIds(res.body)).toEqual([P.textbook, P.set, P.circle]);
  });
});

describe('addWorksheetItem: someone else’s problem (D-27)', () => {
  const ctx = useTestApp();

  it('copies it first and adds the copy', async () => {
    const res = await ctx()
      .api.as('jan')
      .post(`/worksheets/${W.linear}/items`, { lockVersion: 1, problemId: P.pythagoras, afterId: P.set })
      .expect(200);
    const added = res.body.items[1].problem;
    expect(added.id).not.toBe(P.pythagoras);
    expect(added).toMatchObject({ name: 'Pythagorova věta', originalId: P.pythagoras });
    expect(added.author.id).toBe(seed.users.jan);
  });
});

describe('reorderWorksheetItem', () => {
  const ctx = useTestApp();

  it('moves an item to the first place', async () => {
    const res = await ctx()
      .api.as('jan')
      .patch(`/worksheets/${W.linear}/items/${P.circle}`, { lockVersion: 1, afterId: null })
      .expect(200);
    expect(itemIds(res.body)).toEqual([P.circle, P.set]);
    expect(res.body).toMatchObject({ version: 2, lockVersion: 2 });
  });
});

describe('removeWorksheetItem', () => {
  const ctx = useTestApp();

  it('unlinks the item (200 with the worksheet); the problem itself stays', async () => {
    const { api } = ctx();
    const res = await api.as('jan').delete(`/worksheets/${W.linear}/items/${P.circle}`).set('If-Match', '"1"').expect(200);
    expect(itemIds(res.body)).toEqual([P.set]);
    expect(res.body).toMatchObject({ itemCount: 1, lockVersion: 2 });
    await api.as('jan').get(`/problems/${P.circle}`).expect(200);
  });
});
