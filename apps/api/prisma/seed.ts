/**
 * Seed for the Prisma data source: `pnpm --filter @matematika/api db:seed` (= `prisma db seed`).
 * The data itself is in seed-database.ts. Runs only on an empty database, so running it twice
 * does not duplicate anything.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedDatabase } from './seed-database.js';

// Same fallback as prisma.config.ts (docker-compose.dev.yml).
const connectionString = process.env.DATABASE_URL ?? 'postgresql://app:app@localhost:5432/sbirka';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  if ((await prisma.user.count()) > 0) {
    console.log('db:seed skipped: the database is not empty.');
    return;
  }
  await seedDatabase(prisma);
  console.log('db:seed done: 1 language, 4 users (jan, eva, petr, blocked), 4 licences, 4 tags, 4 chapters, 7 problems.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
