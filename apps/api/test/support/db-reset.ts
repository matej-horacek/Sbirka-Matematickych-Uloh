import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { seedDatabase } from '../../prisma/seed-database.js';

/**
 * DATA_SOURCE=prisma only: empties every table (ids restart at 1) and loads the seed, so each test file
 * starts from the same data as a fresh MockDatabase (the tests use hard-coded Sqids of ids 1..7).
 *
 * TRUNCATE is destructive, so this refuses to touch any database whose name does not end in "_test":
 * `apps/api/.env` points DATABASE_URL at the dev database, and `pnpm test:prisma` sets its own.
 */
export async function resetDatabase(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required when DATA_SOURCE=prisma.');
  const database = new URL(url).pathname.replace(/^\//, '');
  if (!database.endsWith('_test')) {
    throw new Error(
      `Refusing to reset database "${database}": the e2e tests truncate every table, so the name must end in "_test". ` +
        'Use `pnpm test:prisma` (throwaway Postgres on port 5433).',
    );
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    if (tables.length) {
      const list = tables.map((t) => `"${t.tablename}"`).join(', ');
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
    }
    await seedDatabase(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
