import { useTestApp } from '../support/app';
import { expectError } from '../support/expect';
import { createProblem } from '../support/factory';
import { malformedIds, seed, unknownId } from '../support/seed';

// publishProblem — POST /problems/{id}/publish
// Spec: the author, if verified or trusted. trusted/admin → PUBLISHED; verified → REVIEWING;
// registered → 403 TRUST_TOO_LOW. Needs a licence that allows publication: send licenseId if none
// yet; ignored if one is set. On a set: parent + all children as one unit, licenseId applied to every
// item without a licence; a child with a non-publishable licence → 409 LICENSE_REQUIRED (detail names it).
// Already PUBLISHED/REVIEWING → 200, no change. BLOCKED → 403. Set child → 409 SET_CHILD_NOT_PUBLISHABLE.
// Not tested here (O-items): O5 (how auto-approved revisions are marked).
// Not testable through the API: BLOCKED (no endpoint sets it; moderation is Phase B). Admin role (no admin mock user).
describe('publishProblem POST /problems/{id}/publish', () => {
  const ctx = useTestApp();
  const P = seed.problems;

  describe('status by trust level (response + store)', () => {
    it('trusted (jan) → PUBLISHED, licence stored', async () => {
      const { api, store } = ctx();
      const p = await createProblem(api, 'jan');
      const res = await api.as('jan').post(`/problems/${p.id}/publish`, { licenseId: seed.licenses.ccBy }).expect(200);
      expect(res.body).toMatchObject({ id: p.id, status: 'PUBLISHED', source: { type: 'OWN', license: { id: seed.licenses.ccBy, name: 'CC BY 4.0' } } });
      await store.expectRecord('problems', p.id, { publishStatus: 'PUBLISHED', source: { licenseId: 2, originType: 'OWN' } });
      // Visible to everyone now.
      await ctx().api.as('petr').get(`/problems/${p.id}`).expect(200);
    });

    it('verified (eva) → REVIEWING, licence stored, not public yet', async () => {
      const { api, store } = ctx();
      const p = await createProblem(api, 'eva');
      const res = await api.as('eva').post(`/problems/${p.id}/publish`, { licenseId: seed.licenses.cc0 }).expect(200);
      expect(res.body.status).toBe('REVIEWING');
      await store.expectRecord('problems', p.id, { publishStatus: 'REVIEWING', source: { licenseId: 1 } });
      expectError(await api.as('jan').get(`/problems/${p.id}`), 404, 'NOT_FOUND');
    });

    it('registered (petr) → 403 TRUST_TOO_LOW, nothing changes', async () => {
      const { api, store } = ctx();
      const p = await createProblem(api, 'petr');
      expectError(await api.as('petr').post(`/problems/${p.id}/publish`, { licenseId: seed.licenses.cc0 }), 403, 'TRUST_TOO_LOW');
      await store.expectRecord('problems', p.id, { publishStatus: 'PRIVATE', source: { licenseId: null } });
    });
  });

  describe('licence', () => {
    it('no licence and no licenseId → 409 LICENSE_REQUIRED, nothing changes', async () => {
      const { api, store } = ctx();
      const p = await createProblem(api, 'jan');
      expectError(await api.as('jan').post(`/problems/${p.id}/publish`, {}), 409, 'LICENSE_REQUIRED');
      expectError(await api.as('jan').post(`/problems/${p.id}/publish`), 409, 'LICENSE_REQUIRED');
      await store.expectRecord('problems', p.id, { publishStatus: 'PRIVATE', source: { licenseId: null } });
    });

    it('a licence that does not allow publication → 409 LICENSE_REQUIRED, nothing changes', async () => {
      const { api, store } = ctx();
      const p = await createProblem(api, 'jan');
      expectError(await api.as('jan').post(`/problems/${p.id}/publish`, { licenseId: seed.licenses.allRightsReserved }), 409, 'LICENSE_REQUIRED');
      await store.expectRecord('problems', p.id, { publishStatus: 'PRIVATE', source: { licenseId: null } });
    });

    it('an unknown licenseId → 409 LICENSE_REQUIRED', async () => {
      const { api } = ctx();
      const p = await createProblem(api, 'jan');
      expectError(await api.as('jan').post(`/problems/${p.id}/publish`, { licenseId: unknownId }), 409, 'LICENSE_REQUIRED');
    });

    it('a problem whose existing licence does not allow publication → 409 LICENSE_REQUIRED', async () => {
      const { api, store } = ctx();
      expectError(await api.as('jan').post(`/problems/${P.textbook}/publish`, { licenseId: seed.licenses.ccBy }), 409, 'LICENSE_REQUIRED');
      await store.expectRecord('problems', P.textbook, { publishStatus: 'PRIVATE', source: { licenseId: 4 } });
    });

    it('an existing licence is kept; licenseId is ignored (licences are irrevocable)', async () => {
      const { api, store } = ctx();
      // A copy of Eva's CC0 problem inherits CC0.
      const copy = (await api.as('jan').post(`/problems/${P.pythagoras}/copy`).expect(201)).body;
      const res = await api.as('jan').post(`/problems/${copy.id}/publish`, { licenseId: seed.licenses.ccBy }).expect(200);
      expect(res.body).toMatchObject({ status: 'PUBLISHED', source: { license: { id: seed.licenses.cc0 } } });
      await store.expectRecord('problems', copy.id, { publishStatus: 'PUBLISHED', source: { licenseId: 1 } });
    });

    it('with an existing licence, no body is needed', async () => {
      const { api } = ctx();
      const copy = (await api.as('jan').post(`/problems/${P.pythagoras}/copy`).expect(201)).body;
      const res = await api.as('jan').post(`/problems/${copy.id}/publish`).expect(200);
      expect(res.body.status).toBe('PUBLISHED');
    });

    // Not tested: a malformed licenseId. The mock answers 409 LICENSE_REQUIRED; the spec declares no 400 for
    // publishProblem (SPEC_CHECK C-6), so the "right" answer is not stated. Left to Daniel (spec gap, not a mock bug).
  });

  describe('a set (parent + children as one unit)', () => {
    const fresh = useTestApp();

    it('publishes the parent and every child; licenseId goes to every item without a licence', async () => {
      const { api, store } = fresh();
      const res = await api.as('jan').post(`/problems/${P.set}/publish`, { licenseId: seed.licenses.ccBy }).expect(200);
      expect(res.body.status).toBe('PUBLISHED');
      for (const c of res.body.children) expect(c.source.license).toMatchObject({ id: seed.licenses.ccBy });
      for (const id of [P.set, P.childA, P.childB]) {
        await store.expectRecord('problems', id, { publishStatus: 'PUBLISHED', source: { licenseId: 2 } });
      }
    });

    it('a set child on its own → 409 SET_CHILD_NOT_PUBLISHABLE', async () => {
      const app2 = fresh();
      // On a fresh copy of the set, so the child is still PRIVATE.
      const copy = (await app2.api.as('jan').post(`/problems/${P.set}/copy`).expect(201)).body;
      const child = copy.children[0].id;
      expectError(await app2.api.as('jan').post(`/problems/${child}/publish`, { licenseId: seed.licenses.ccBy }), 409, 'SET_CHILD_NOT_PUBLISHABLE');
      await app2.store.expectRecord('problems', child, { publishStatus: 'PRIVATE' });
    });
  });

  describe('a set with a child whose licence forbids publication', () => {
    it.skip('409 LICENSE_REQUIRED naming the child; nothing is published [R-002 needed to build the set]', async () => {
      // Arrange the 2.0.0 way: copy the textbook problem (All rights reserved) into a new set.
      const { api, store } = ctx();
      const set = await createProblem(api, 'jan');
      const withChild = (await api.as('jan').post(`/problems/${set.id}/children`, { lockVersion: 1, copyFromId: P.textbook }).expect(200)).body;
      const res = await api.as('jan').post(`/problems/${set.id}/publish`, { licenseId: seed.licenses.ccBy });
      expectError(res, 409, 'LICENSE_REQUIRED');
      expect(res.body.detail).toContain('Úloha z učebnice');
      await store.expectRecord('problems', set.id, { publishStatus: 'PRIVATE' });
      await store.expectRecord('problems', withChild.children[0].id, { publishStatus: 'PRIVATE' });
    });
  });

  describe('idempotent: already PUBLISHED or REVIEWING → 200, no change', () => {
    it('PUBLISHED', async () => {
      const { api, store } = ctx();
      const before = structuredClone(await store.expectRecord('problems', P.circle));
      const res = await api.as('jan').post(`/problems/${P.circle}/publish`, { licenseId: seed.licenses.cc0 }).expect(200);
      expect(res.body).toMatchObject({ status: 'PUBLISHED', source: { license: { id: seed.licenses.ccBy } } });
      expect(await store.expectRecord('problems', P.circle)).toEqual(before);
    });

    it('REVIEWING', async () => {
      const { api, store } = ctx();
      const p = await createProblem(api, 'eva');
      await api.as('eva').post(`/problems/${p.id}/publish`, { licenseId: seed.licenses.cc0 }).expect(200);
      const before = structuredClone(await store.expectRecord('problems', p.id));
      const res = await api.as('eva').post(`/problems/${p.id}/publish`, { licenseId: seed.licenses.ccBy }).expect(200);
      expect(res.body.status).toBe('REVIEWING');
      expect(await store.expectRecord('problems', p.id)).toEqual(before);
    });
  });

  describe('auth and ownership', () => {
    it('401 UNAUTHENTICATED without a token', async () => {
      expectError(await ctx().api.post(`/problems/${P.evaPrivate}/publish`, { licenseId: seed.licenses.cc0 }), 401, 'UNAUTHENTICATED');
    });

    it('403 FORBIDDEN for another teacher’s PUBLISHED problem', async () => {
      expectError(await ctx().api.as('jan').post(`/problems/${P.pythagoras}/publish`), 403, 'FORBIDDEN');
    });

    it('404 NOT_FOUND for another teacher’s PRIVATE problem; nothing changes', async () => {
      const { api, store } = ctx();
      expectError(await api.as('jan').post(`/problems/${P.evaPrivate}/publish`, { licenseId: seed.licenses.cc0 }), 404, 'NOT_FOUND');
      await store.expectRecord('problems', P.evaPrivate, { publishStatus: 'PRIVATE' });
    });

    it('404 for an unknown or malformed id', async () => {
      const { api } = ctx();
      expectError(await api.as('jan').post(`/problems/${unknownId}/publish`), 404, 'NOT_FOUND');
      for (const bad of malformedIds) expectError(await api.as('jan').post(`/problems/${encodeURIComponent(bad)}/publish`), 404, 'NOT_FOUND');
    });
  });
});
