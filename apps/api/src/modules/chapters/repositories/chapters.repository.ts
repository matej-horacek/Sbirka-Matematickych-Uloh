import type { ChapterRow } from '../../../database/mock-database';

export const CHAPTERS_REPOSITORY = Symbol('CHAPTERS_REPOSITORY');

/** Data access for chapters. Only queries, no decisions. Implementations: Mock…, Prisma… */
export interface ChaptersRepository {
  /** Global chapters plus the user's own personal ones, sorted by name. */
  findVisible(userId: number): Promise<ChapterRow[]>;
  findByIds(ids: number[]): Promise<ChapterRow[]>;
  /** Every chapter (the service walks the parent links to find descendants). */
  findAll(): Promise<ChapterRow[]>;
}
