import { encodeId } from '../../src/common/utils/ids';

// Named ids for the mock seed (src/database/mock-seed.ts), as the API shows them (Sqids).
// Encoded at runtime, so they stay right if SQIDS_ALPHABET is set.
export const seed = {
  users: { jan: encodeId(1), eva: encodeId(2), petr: encodeId(3) },
  problems: {
    /** Jan's PRIVATE set "Řešte rovnice" (lockVersion 3), children a) and b). */
    set: encodeId(1),
    childA: encodeId(2),
    childB: encodeId(3),
    /** Jan's PUBLISHED "Obsah kruhu", licence CC BY 4.0, global tag/chapter. */
    circle: encodeId(4),
    /** Eva's PUBLISHED "Pythagorova věta", licence CC0. */
    pythagoras: encodeId(5),
    /** Eva's PRIVATE "Soustava rovnic": invisible to everyone else. */
    evaPrivate: encodeId(6),
    /** Jan's PRIVATE LICENSED_USE problem under "Všechna práva vyhrazena" (publishing must fail). */
    textbook: encodeId(7),
  },
  licenses: { cc0: encodeId(1), ccBy: encodeId(2), ccBySa: encodeId(3), allRightsReserved: encodeId(4) },
  tags: { linear: encodeId(1), quadratic: encodeId(2), geometry: encodeId(3), janPersonal: encodeId(4) },
  chapters: { equations: encodeId(1), linearEquations: encodeId(2), planimetry: encodeId(3), janPersonal: encodeId(4) },
} as const;

/** A well-formed Sqid that no seed row uses. */
export const unknownId = encodeId(9999);
/** Strings that are not canonical Sqids (decode fails or re-encode differs). */
export const malformedIds = ['!!!', 'a', '0'];
