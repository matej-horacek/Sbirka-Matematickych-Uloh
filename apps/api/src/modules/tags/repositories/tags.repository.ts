import type { TagRow } from '../../../database/mock-database.js';

export const TAGS_REPOSITORY = Symbol('TAGS_REPOSITORY');

/** Data access for tags. Only queries, no decisions. Implementations: Mock…, Prisma… */
export interface TagsRepository {
  /** Global tags plus the user's own personal ones, sorted by name; `q` filters by name (case-insensitive contains). */
  findVisible(userId: number, q?: string): Promise<TagRow[]>;
  findByIds(ids: number[]): Promise<TagRow[]>;
}
