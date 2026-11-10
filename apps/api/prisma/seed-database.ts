/**
 * The seed data for the Prisma data source, as a function so both `prisma db seed` (prisma/seed.ts)
 * and the e2e tests (test/support/db-reset.ts, a reset before every test file) can use it.
 *
 * Mirrors the mock seed (src/database/mock-seed.ts) closely enough for the e2e tests:
 * same users, same ids on an EMPTY database (autoincrement starts at 1), same names.
 * Login in prisma mode: <username>@example.test + SEED_PASSWORD (jan, eva, petr; `blocked` is blocked).
 */
import * as argon2 from 'argon2';
import { SEED_PASSWORD } from '../src/database/mock-seed.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';

/** A problem to seed. Tag, chapter and licence ids are the ids created by this seed. */
interface SeedProblem {
  name: string;
  assignment: string;
  result?: string;
  difficulty: number;
  authorId: number;
  publishStatus?: 'PRIVATE' | 'PUBLISHED';
  lockVersion?: number;
  /** Defaults to OWN without licence. */
  source?: { originType?: 'OWN' | 'LICENSED_USE' | 'FREE_USE'; citationText?: string; licenseId?: number };
  /** Index (in creation order) of the set this problem is a child of, plus its position key. */
  parentIndex?: number;
  position?: string;
  tagIds: number[];
  chapterIds: number[];
}

/** Fills an EMPTY database (ids start at 1; the caller truncates with RESTART IDENTITY when it reuses one). */
export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  // cs first (users and problems use it). A problem's language must be one of these (an unknown code is a 400).
  const cs = await prisma.language.create({ data: { code: 'cs', name: 'Čeština' } });
  await prisma.language.createMany({
    data: [
      { code: 'sk', name: 'Slovenčina' },
      { code: 'en', name: 'English' },
    ],
  });

  // One after another, so ids are 1, 2, 3 in this order (the tests rely on it).
  // `blocked` is for the ACCOUNT_BLOCKED checks.
  const users = [
    { username: 'jan', display_name: 'Jan Novák', role: 'TRUSTED_TEACHER', status: 'ACTIVE' },
    { username: 'eva', display_name: 'Eva Svobodová', role: 'VERIFIED_TEACHER', status: 'ACTIVE' },
    { username: 'petr', display_name: 'Petr Dvořák', role: 'REGISTERED_TEACHER', status: 'ACTIVE' },
    { username: 'blocked', display_name: 'Blokovaný Uživatel', role: 'REGISTERED_TEACHER', status: 'BLOCKED' },
  ] as const;
  const passwordHash = await argon2.hash(SEED_PASSWORD);
  const created = [];
  for (const u of users) {
    created.push(
      await prisma.user.create({
        data: {
          ...u,
          email: `${u.username}@example.test`,
          password_hash: passwordHash,
          language_id: cs.id,
        },
      }),
    );
  }
  const jan = created[0];

  // The three licences of the spec (the picker lists licences that allow publication).
  await prisma.license.createMany({
    data: [
      {
        name: 'CC0 1.0',
        description: 'Volné dílo, bez nutnosti uvádět autora.',
        url: 'https://creativecommons.org/publicdomain/zero/1.0/',
        requires_attribution: false,
        allows_modification: true,
        requires_share_alike: false,
        allows_publication: true,
      },
      {
        name: 'CC BY 4.0',
        description: 'Užití i úpravy s uvedením autora.',
        url: 'https://creativecommons.org/licenses/by/4.0/',
        requires_attribution: true,
        allows_modification: true,
        requires_share_alike: false,
        allows_publication: true,
      },
      {
        name: 'CC BY-SA 4.0',
        description: 'S uvedením autora, úpravy pod stejnou licencí.',
        url: 'https://creativecommons.org/licenses/by-sa/4.0/',
        requires_attribution: true,
        allows_modification: true,
        requires_share_alike: true,
        allows_publication: true,
      },
      // Protected third-party content: not offered in the picker, but a copied-in problem may carry it.
      {
        name: 'Všechna práva vyhrazena',
        description: 'Cizí chráněný obsah, jen pro soukromé užití.',
        url: null,
        requires_attribution: true,
        allows_modification: false,
        requires_share_alike: false,
        allows_publication: false,
      },
    ],
  });

  await prisma.tag.createMany({
    data: [
      { name: 'lineární rovnice', is_global: true },
      { name: 'kvadratické rovnice', is_global: true },
      { name: 'geometrie', is_global: true },
      { name: 'opakování 2.A', is_global: false, author_id: jan.id },
    ],
  });

  const equations = await prisma.chapter.create({ data: { name: 'Rovnice', is_global: true } });
  await prisma.chapter.create({ data: { name: 'Lineární rovnice', is_global: true, parent_id: equations.id } });
  await prisma.chapter.create({ data: { name: 'Planimetrie', is_global: true } });
  // One personal child chapter (Jan's), under a global parent.
  await prisma.chapter.create({
    data: { name: 'Rovnice – opakování 2.A', is_global: false, author_id: jan.id, parent_id: equations.id },
  });

  // The 7 problems of the mock seed (same ids 1..7 on an empty database).
  // Ids of tags, chapters and licences below are the autoincrement ids created above.
  const problemIds: number[] = [];
  async function createProblem(p: SeedProblem): Promise<void> {
    const source = p.source ?? {};
    const created = await prisma.problem.create({
      data: {
        name: p.name,
        assignment: p.assignment,
        result: p.result ?? null,
        difficulty: p.difficulty,
        publish_status: p.publishStatus ?? 'PRIVATE',
        lock_version: p.lockVersion ?? 1,
        user: { connect: { id: p.authorId } },
        language: { connect: { id: cs.id } },
        content_source: {
          create: {
            origin_type: source.originType ?? 'OWN',
            source_citation_text: source.citationText ?? null,
            license_id: source.licenseId ?? null,
          },
        },
      },
    });
    await prisma.problem_tag.createMany({ data: p.tagIds.map((tag_id) => ({ problem_id: created.id, tag_id })) });
    await prisma.problem_chapter.createMany({
      data: p.chapterIds.map((chapter_id) => ({ problem_id: created.id, chapter_id })),
    });
    if (p.parentIndex !== undefined) {
      await prisma.problem_part.create({
        data: { parent_id: problemIds[p.parentIndex], child_id: created.id, position: p.position ?? 'a0' },
      });
    }
    problemIds.push(created.id);
  }

  // A private set of Jan's with two children (problems 1, 2, 3).
  await createProblem({
    name: 'Řešte rovnice',
    assignment: 'Vyřešte rovnice v oboru reálných čísel:',
    difficulty: 3,
    authorId: 1,
    lockVersion: 3,
    tagIds: [1, 2, 4],
    chapterIds: [1],
  });
  await createProblem({
    name: 'Rovnice a)',
    assignment: '\\( 2x + 3 = 11 \\)',
    result: '\\( x = 4 \\)',
    difficulty: 2,
    authorId: 1,
    parentIndex: 0,
    position: 'a0',
    tagIds: [1],
    chapterIds: [2],
  });
  await createProblem({
    name: 'Rovnice b)',
    assignment: '\\( x^2 = 9 \\)',
    result: '\\( x = \\pm 3 \\)',
    difficulty: 3,
    authorId: 1,
    parentIndex: 0,
    position: 'a1',
    tagIds: [2],
    chapterIds: [1],
  });
  // Published problems that others can see and copy (4, 5).
  await createProblem({
    name: 'Obsah kruhu',
    assignment: 'Vypočítejte obsah kruhu o poloměru \\( r = 5\\,\\text{cm} \\).',
    result: '\\( S = 25\\pi\\,\\text{cm}^2 \\)',
    difficulty: 2,
    authorId: 1,
    publishStatus: 'PUBLISHED',
    source: { licenseId: 2 },
    tagIds: [3],
    chapterIds: [3],
  });
  await createProblem({
    name: 'Pythagorova věta',
    assignment: 'Odvěsny pravoúhlého trojúhelníku mají délky \\( 3 \\) a \\( 4 \\). Určete přeponu.',
    result: '\\( c = 5 \\)',
    difficulty: 1,
    authorId: 2,
    publishStatus: 'PUBLISHED',
    source: { licenseId: 1 },
    tagIds: [3],
    chapterIds: [3],
  });
  // Eva's private problem (6): Jan must get 404.
  await createProblem({
    name: 'Soustava rovnic',
    assignment: '\\( x + y = 5,\\; x - y = 1 \\)',
    result: '\\( x = 3,\\; y = 2 \\)',
    difficulty: 3,
    authorId: 2,
    tagIds: [1],
    chapterIds: [1],
  });
  // A copied-in problem under a protected licence (7): publishing it must fail.
  await createProblem({
    name: 'Úloha z učebnice',
    assignment: 'Vyřešte \\( 5x = 20 \\).',
    result: '\\( x = 4 \\)',
    difficulty: 1,
    authorId: 1,
    source: { originType: 'LICENSED_USE', citationText: 'Učebnice Matematika 1, s. 42', licenseId: 4 },
    tagIds: [1],
    chapterIds: [2],
  });
}
