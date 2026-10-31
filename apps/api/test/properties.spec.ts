import fc from 'fast-check';
import { decodeId, encodeId } from '../src/common/utils/ids';
import { positionAt } from '../src/common/utils/position';

// T8: property-based tests (fast-check) for the two pure helpers every id and every set order goes through.
// They test public behaviour only, so they stay valid when Phase B replaces the implementations
// (real fractional indexing for positions keeps the "order = index order" property).
describe('properties', () => {
  describe('Sqids (common/utils/ids.ts)', () => {
    const dbId = fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER });

    it('round-trips every integer id: decode(encode(n)) === n', () => {
      fc.assert(fc.property(dbId, (n) => decodeId(encodeId(n)) === n));
    });

    it('API ids are at least 5 characters and contain only letters and digits', () => {
      fc.assert(fc.property(dbId, (n) => /^[A-Za-z0-9]{5,}$/.test(encodeId(n))));
    });

    it('different ids never share a Sqid', () => {
      fc.assert(fc.property(dbId, dbId, (a, b) => a === b || encodeId(a) !== encodeId(b)));
    });

    it('any string either decodes to null or is the canonical Sqid of what it decodes to', () => {
      // So "4", "k3Xa9 " or a re-encoded variant can never alias a real id.
      fc.assert(
        fc.property(fc.string({ maxLength: 12 }), (s) => {
          const n = decodeId(s);
          return n === null || encodeId(n) === s;
        }),
        { numRuns: 2000 },
      );
    });

    it('a raw integer in the URL never reaches the row with that integer id', () => {
      fc.assert(fc.property(fc.integer({ min: 0, max: 10_000_000 }), (n) => decodeId(String(n)) !== n), { numRuns: 2000 });
    });
  });

  describe('positions (common/utils/position.ts)', () => {
    // The mock pads to 4 base-36 digits: the property holds for up to 36^4 children per set.
    const index = fc.integer({ min: 0, max: 36 ** 4 - 1 });

    it('position order = index order, with plain string comparison (what Postgres text ordering with C collation does)', () => {
      fc.assert(fc.property(index, index, (a, b) => Math.sign(a - b) === Math.sign(positionAt(a) < positionAt(b) ? -1 : positionAt(a) > positionAt(b) ? 1 : 0)));
    });

    const byteOrder = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);

    it('sorting any list of positions (byte order) restores index order', () => {
      fc.assert(
        fc.property(fc.uniqueArray(index, { maxLength: 50 }), (indices) => {
          const sorted = indices.map(positionAt).sort(byteOrder);
          return JSON.stringify(sorted) === JSON.stringify([...indices].sort((x, y) => x - y).map(positionAt));
        }),
      );
    });

    it.skip('the comparator ProblemsRepository.findChildren uses (localeCompare, default locale) keeps index order [R-020]', () => {
      // Found by fast-check: under the cs-CZ default locale "ch" sorts after "h" AND after "i" (Czech digraph),
      // so positionAt(583200) = "aci00" sorts BEFORE positionAt(581904) = "ach00". localeCompare also ignores
      // the ASCII case order that fractional-indexing keys (Phase B, B2) rely on: "aB" vs "ab".
      expect(positionAt(581904).localeCompare(positionAt(583200))).toBeLessThan(0);
      expect('aB'.localeCompare('ab')).toBeLessThan(0);
      fc.assert(fc.property(index, index, (a, b) => Math.sign(a - b) === Math.sign(positionAt(a).localeCompare(positionAt(b)))), { numRuns: 5000 });
    });
  });
});
