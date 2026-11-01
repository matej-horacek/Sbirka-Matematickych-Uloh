import { createTestApp, useTestApp } from './support/app';
import { seed } from './support/seed';

// Proves the harness itself: fresh store per app, contract validation runs, store probe reads the DI instance.
describe('Test harness', () => {
  const ctx = useTestApp();

  it('serves the API under /api/v1 with the real AppModule and guard', async () => {
    await ctx().api.get('/tags').expect(401);
    await ctx().api.as('jan').get('/tags').expect(200);
  });

  it('validates every response against openapi.yaml', async () => {
    // A response that violates the contract makes the request's promise reject.
    const { api } = ctx();
    await expect(api.as('jan').get('/licenses').expect(200)).resolves.toBeDefined();
    // A path outside the spec can never pass, whatever its status: proves the check is wired in.
    await expect(api.as('jan').get('/not-in-spec')).rejects.toThrow(/Contract violation[\s\S]*not an operation in openapi.yaml/);
  });

  it('reads the same MockDatabase instance the app uses', async () => {
    const { api, store } = ctx();
    const before = await store.countRecords('problems');
    const res = await api.as('eva').post('/problems', { name: 'H', assignment: 'harness' }).expect(201);
    expect(await store.countRecords('problems')).toBe(before + 1);
    await store.expectRecord('problems', res.body.id, { name: 'H', authorId: 2 });
  });

  it('decodes Sqids and reports soft-deletes', async () => {
    const { store } = ctx();
    await store.expectRecord('problems', seed.problems.circle, { id: 4, publishStatus: 'PUBLISHED' });
    await store.expectRecord('problems', 4);
    await expect(store.expectNoRecord('problems', seed.problems.circle)).rejects.toThrow(/exists/);
    await expect(store.expectDeleted('problems', seed.problems.circle)).rejects.toThrow(/deletedAt is null/);
    await store.expectNoRecord('problems', 9999);
  });

  it('gives each app its own store', async () => {
    const other = await createTestApp();
    try {
      // The problem created above exists in this file's app only.
      expect(await other.store.countRecords('problems', { name: 'H' })).toBe(0);
      expect(await ctx().store.countRecords('problems', { name: 'H' })).toBe(1);
    } finally {
      await other.app.close();
    }
  });
});
