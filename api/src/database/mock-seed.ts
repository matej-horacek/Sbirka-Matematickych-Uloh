import type {
  ChapterRow,
  ContentSourceRow,
  LicenseRow,
  ProblemRow,
  TagRow,
  UserRow,
} from './mock-database';

// Same content as the examples in openapi.yaml, so the real backend and the
// Prism mock return the same kind of data (ids differ: here they are real Sqids).

const OWN: ContentSourceRow = {
  originType: 'OWN',
  sourceCitationText: null,
  licenseId: null,
  licenseNote: null,
  citationAudience: 'PUBLIC',
  showInWeb: true,
  showInPdf: true,
};

const t0 = new Date('2026-10-20T09:15:00Z');

function problem(p: Partial<ProblemRow> & Pick<ProblemRow, 'id' | 'name' | 'assignment' | 'authorId'>): ProblemRow {
  return {
    result: null,
    languageCode: 'cs',
    difficulty: null,
    publishStatus: 'PRIVATE',
    version: 1,
    lockVersion: 1,
    parentId: null,
    position: null,
    originalProblemId: null,
    originalProblemVersion: null,
    source: { ...OWN },
    tagIds: [],
    chapterIds: [],
    createdAt: t0,
    updatedAt: t0,
    deletedAt: null,
    ...p,
  };
}

export function seed() {
  // Log in to the mock with `Authorization: Bearer jan` (trusted),
  // `Bearer eva` (verified) or `Bearer petr` (registered).
  const users: UserRow[] = [
    { id: 1, displayName: 'Jan Novák', role: 'TEACHER', trust: 'TRUSTED', mockToken: 'jan' },
    { id: 2, displayName: 'Eva Svobodová', role: 'TEACHER', trust: 'VERIFIED', mockToken: 'eva' },
    { id: 3, displayName: 'Petr Dvořák', role: 'TEACHER', trust: 'REGISTERED', mockToken: 'petr' },
  ];

  const licenses: LicenseRow[] = [
    { id: 1, name: 'CC0 1.0', description: 'Volné dílo, bez nutnosti uvádět autora.', url: 'https://creativecommons.org/publicdomain/zero/1.0/', requiresAttribution: false, allowsModification: true, requiresShareAlike: false, allowsPublication: true },
    { id: 2, name: 'CC BY 4.0', description: 'Užití i úpravy s uvedením autora.', url: 'https://creativecommons.org/licenses/by/4.0/', requiresAttribution: true, allowsModification: true, requiresShareAlike: false, allowsPublication: true },
    { id: 3, name: 'CC BY-SA 4.0', description: 'S uvedením autora, úpravy pod stejnou licencí.', url: 'https://creativecommons.org/licenses/by-sa/4.0/', requiresAttribution: true, allowsModification: true, requiresShareAlike: true, allowsPublication: true },
    { id: 4, name: 'Všechna práva vyhrazena', description: 'Cizí chráněný obsah, jen pro soukromé užití.', url: null, requiresAttribution: true, allowsModification: false, requiresShareAlike: false, allowsPublication: false },
  ];

  const tags: TagRow[] = [
    { id: 1, name: 'lineární rovnice', isGlobal: true, ownerId: null },
    { id: 2, name: 'kvadratické rovnice', isGlobal: true, ownerId: null },
    { id: 3, name: 'geometrie', isGlobal: true, ownerId: null },
    { id: 4, name: 'opakování 2.A', isGlobal: false, ownerId: 1 },
  ];

  const chapters: ChapterRow[] = [
    { id: 1, name: 'Rovnice', isGlobal: true, ownerId: null, parentId: null },
    { id: 2, name: 'Lineární rovnice', isGlobal: true, ownerId: null, parentId: 1 },
    { id: 3, name: 'Planimetrie', isGlobal: true, ownerId: null, parentId: null },
    { id: 4, name: 'Rovnice – opakování 2.A', isGlobal: false, ownerId: 1, parentId: 1 },
  ];

  const problems: ProblemRow[] = [
    // A private set of Jan's with two children.
    problem({ id: 1, name: 'Řešte rovnice', assignment: 'Vyřešte rovnice v oboru reálných čísel:', difficulty: 3, authorId: 1, lockVersion: 3, tagIds: [1, 2, 4], chapterIds: [1] }),
    problem({ id: 2, name: 'Rovnice a)', assignment: '\\( 2x + 3 = 11 \\)', result: '\\( x = 4 \\)', difficulty: 2, authorId: 1, parentId: 1, position: 'a0', tagIds: [1], chapterIds: [2] }),
    problem({ id: 3, name: 'Rovnice b)', assignment: '\\( x^2 = 9 \\)', result: '\\( x = \\pm 3 \\)', difficulty: 3, authorId: 1, parentId: 1, position: 'a1', tagIds: [2], chapterIds: [1] }),
    // Published problems that others can see and copy.
    problem({ id: 4, name: 'Obsah kruhu', assignment: 'Vypočítejte obsah kruhu o poloměru \\( r = 5\\,\\text{cm} \\).', result: '\\( S = 25\\pi\\,\\text{cm}^2 \\)', difficulty: 2, authorId: 1, publishStatus: 'PUBLISHED', source: { ...OWN, licenseId: 2 }, tagIds: [3], chapterIds: [3] }),
    problem({ id: 5, name: 'Pythagorova věta', assignment: 'Odvěsny pravoúhlého trojúhelníku mají délky \\( 3 \\) a \\( 4 \\). Určete přeponu.', result: '\\( c = 5 \\)', difficulty: 1, authorId: 2, publishStatus: 'PUBLISHED', source: { ...OWN, licenseId: 1 }, tagIds: [3], chapterIds: [3] }),
    // Eva's private problem: Jan must get 404.
    problem({ id: 6, name: 'Soustava rovnic', assignment: '\\( x + y = 5,\\; x - y = 1 \\)', result: '\\( x = 3,\\; y = 2 \\)', difficulty: 3, authorId: 2, tagIds: [1], chapterIds: [1] }),
    // A copied-in problem under a protected licence: publishing it must fail.
    problem({ id: 7, name: 'Úloha z učebnice', assignment: 'Vyřešte \\( 5x = 20 \\).', result: '\\( x = 4 \\)', difficulty: 1, authorId: 1, source: { ...OWN, originType: 'LICENSED_USE', sourceCitationText: 'Učebnice Matematika 1, s. 42', licenseId: 4 }, tagIds: [1], chapterIds: [2] }),
  ];

  return { users, licenses, tags, chapters, problems };
}
