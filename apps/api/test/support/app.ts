import cookieParser from 'cookie-parser';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { ProblemDetailsFilter } from '../../src/common/filters/problem-details.filter.js';
import { dataSource } from '../../src/config/data-source.js';
import { MockDatabase } from '../../src/database/mock-database.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import { createApi, type Api } from './api.js';
import { resetDatabase } from './db-reset.js';
import { PrismaStoreProbe } from './prisma-store.js';
import { MockStoreProbe, type StoreProbe } from './store.js';

export interface TestContext {
  app: INestApplication;
  /** HTTP client with the /api/v1 prefix and automatic contract validation. */
  api: Api;
  /** Reads the data store directly (MockDatabase, or PrismaService when DATA_SOURCE=prisma). */
  store: StoreProbe;
}

/**
 * A fresh Nest app from the real AppModule, so every call gets its own MockDatabase
 * (seeded from scratch). With DATA_SOURCE=prisma there is one shared Postgres instead, so the database
 * is truncated and re-seeded first (test/support/db-reset.ts): the tests run one file at a time.
 * Closing such an app resets the database again, so a test that opens a second "fresh" app, changes
 * things in it and closes it (the mock gives it a separate store) leaves no changes behind for the next tests.
 * Repeats the three lines of setup that live in main.ts
 * (global prefix, error filter, cookie parser), because main.ts starts a server on import.
 * Nothing in src is changed or mocked.
 */
export async function createTestApp(): Promise<TestContext> {
  if (dataSource() === 'prisma') await resetDatabase();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: ['error'] });
  app.setGlobalPrefix('api/v1'); // keep in sync with src/main.ts
  app.useGlobalFilters(new ProblemDetailsFilter()); // keep in sync with src/main.ts
  app.use(cookieParser()); // keep in sync with src/main.ts
  await app.init();
  if (dataSource() === 'prisma') {
    const close = app.close.bind(app);
    app.close = async () => {
      await close();
      await resetDatabase();
    };
  }
  const store =
    dataSource() === 'prisma'
      ? new PrismaStoreProbe(app.get(PrismaService))
      : new MockStoreProbe(app.get(MockDatabase));
  return { app, api: createApi(app), store };
}

/**
 * One app per test file: call at the top of a file (or a describe block that needs a
 * pristine store) and read `ctx()` inside tests.
 */
export function useTestApp(): () => TestContext {
  let ctx: TestContext | undefined;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx?.app.close();
  });
  return () => {
    if (!ctx) throw new Error('useTestApp(): the app is not ready (call ctx() inside a test or hook)');
    return ctx;
  };
}
