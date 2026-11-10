import type { Provider, Type } from '@nestjs/common';

/**
 * DATA_SOURCE picks the repository implementations for the whole app:
 *   mock    (default) in-memory MockDatabase, no database needed
 *   prisma  PrismaService + Postgres (DATABASE_URL)
 * Read when the modules are loaded, so set it in the environment before the process starts.
 */
export type DataSource = 'mock' | 'prisma';

export function dataSource(): DataSource {
  const value = process.env.DATA_SOURCE ?? 'mock';
  if (value !== 'mock' && value !== 'prisma') {
    throw new Error(`DATA_SOURCE must be "mock" or "prisma", got "${value}"`);
  }
  return value;
}

/** Binds a repository interface token to the Mock or Prisma class, depending on DATA_SOURCE. */
export function repositoryProvider(token: symbol, mock: Type<unknown>, prisma: Type<unknown>): Provider {
  return { provide: token, useClass: dataSource() === 'prisma' ? prisma : mock };
}
