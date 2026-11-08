import type { ProblemRow } from '../../../database/mock-database.js';

export const PROBLEMS_REPOSITORY = Symbol('PROBLEMS_REPOSITORY');

/** Byte order, not localeCompare: fractional-indexing keys are case- and locale-sensitive (R-020). */
export function comparePositions(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export type NewProblem = Omit<ProblemRow, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export interface ProblemFilter {
  authorId?: number;
  publishStatus?: ProblemRow['publishStatus'];
  /** Problem has at least one of these tags. */
  tagIds?: number[];
  /** Problem is in at least one of these chapters (already expanded to descendants). */
  chapterIds?: number[];
  languageCode?: string;
}

/** Data access for problems. Only queries, no decisions. Implementations: Mock…, Prisma… */
export interface ProblemsRepository {
  /** A live (not soft-deleted) problem by id. */
  findById(id: number): Promise<ProblemRow | undefined>;
  /** Live children of a set in position order (byte order, see comparePositions). */
  findChildren(parentId: number): Promise<ProblemRow[]>;
  /** Number of live children per parent id; parents without children map to 0. */
  countChildren(parentIds: number[]): Promise<Map<number, number>>;
  /** Top-level problems only (set children never appear in lists), newest first. */
  findMany(filter: ProblemFilter, page: number, limit: number): Promise<{ rows: ProblemRow[]; total: number }>;
  insert(data: NewProblem): Promise<ProblemRow>;
  update(id: number, data: Partial<ProblemRow>): Promise<ProblemRow>;
  softDelete(ids: number[]): Promise<void>;
  /**
   * Gives the children of a set the positions positionAt(0), positionAt(1), … in the given order.
   * One call, so the (parent, position) uniqueness never trips over a half-finished renumbering.
   */
  renumberChildren(parentId: number, orderedChildIds: number[]): Promise<void>;
}
