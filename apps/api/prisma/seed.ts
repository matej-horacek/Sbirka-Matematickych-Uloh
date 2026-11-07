/**
 * Seed for the Prisma data source: `pnpm --filter @matematika/api db:seed` (= `prisma db seed`).
 *
 * Mirrors the mock seed (src/database/mock-seed.ts) closely enough for the e2e tests:
 * same users, same ids on an EMPTY database (autoincrement starts at 1), same names.
 * Runs only on an empty database, so running it twice does not duplicate anything.
 * Login in prisma mode: `Authorization: Bearer jan` (username).
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

// Not a real hash: nobody can log in with a password until the auth module exists.
const PLACEHOLDER_PASSWORD_HASH = 'PLACEHOLDER-NOT-A-REAL-HASH';

// Same fallback as prisma.config.ts (docker-compose.dev.yml).
const connectionString = process.env.DATABASE_URL ?? 'postgresql://app:app@localhost:5432/sbirka';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  if ((await prisma.user.count()) > 0) {
    console.log('db:seed skipped: the database is not empty.');
    return;
  }

  const cs = await prisma.language.create({ data: { code: 'cs', name: 'Čeština' } });

  // One after another, so ids are 1, 2, 3 in this order (the tests rely on it).
  const users = [
    { username: 'jan', display_name: 'Jan Novák', role: 'TRUSTED_TEACHER' },
    { username: 'eva', display_name: 'Eva Svobodová', role: 'VERIFIED_TEACHER' },
    { username: 'petr', display_name: 'Petr Dvořák', role: 'REGISTERED_TEACHER' },
  ] as const;
  const created = [];
  for (const u of users) {
    created.push(
      await prisma.user.create({
        data: {
          ...u,
          email: `${u.username}@example.test`,
          password_hash: PLACEHOLDER_PASSWORD_HASH,
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
    ],
  });

  await prisma.tag.createMany({
    data: [
      { name: 'lineární rovnice', is_global: true },
      { name: 'kvadratické rovnice', is_global: true },
      { name: 'geometrie', is_global: true },
    ],
  });

  const equations = await prisma.chapter.create({ data: { name: 'Rovnice', is_global: true } });
  await prisma.chapter.create({ data: { name: 'Lineární rovnice', is_global: true, parent_id: equations.id } });
  await prisma.chapter.create({ data: { name: 'Planimetrie', is_global: true } });
  // One personal child chapter (Jan's), under a global parent.
  await prisma.chapter.create({
    data: { name: 'Rovnice – opakování 2.A', is_global: false, author_id: jan.id, parent_id: equations.id },
  });

  console.log('db:seed done: 1 language, 3 users (jan, eva, petr), 3 licences, 3 tags, 4 chapters.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
