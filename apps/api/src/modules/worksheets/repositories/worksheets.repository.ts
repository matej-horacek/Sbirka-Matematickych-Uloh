import type { ProblemRow, WorksheetProblemRow, WorksheetRow } from '../../../database/mock-database.js';


export const WORKSHEETS_REPOSITORY = Symbol('WORKSHEETS_REPOSITORY');
export type NewWorksheet = Omit<WorksheetRow, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export interface WorksheetFilter {
  authorId?: number;
  publishStatus?: ProblemRow['publishStatus'];
  /** Problem has at least one of these tags. */
  tagIds?: number[];
  /** Problem is in at least one of these chapters (already expanded to descendants). */
  chapterIds?: number[];
  languageCode?: string;
}
/** Data access for worksheets. Only queries, no decisions. Implementations: Mock…, Prisma… */
export interface WorksheetsRepository {
  findById(id: number): Promise<WorksheetRow | undefined>;
  /** Global worksheets plus the user's own personal ones, sorted by name. */
  findByIds(ids: number[]): Promise<WorksheetRow[]>;
  findMany(filter: WorksheetFilter, page: number, limit: number): Promise<{ rows: WorksheetRow[]; total: number }>;
  insert(data: NewWorksheet): Promise<WorksheetRow>;
  update(id: number, data: Partial<WorksheetRow>): Promise<WorksheetRow>;
  updateIfLockVersion(id: number, expectedLockVersion: number, data: Partial<WorksheetRow>): Promise<WorksheetRow | null>;
  softDelete(ids: number[]): Promise<void>;
  incrementVersion(id: number): Promise<void>;
  /**
   * The item links of these worksheets, each worksheet's in position order. Only the links: whether a
   * problem is still alive is the problems module's decision (the service asks its facade).
   */
  findItems(worksheetIds: number[]): Promise<WorksheetProblemRow[]>;
  /**
   * Replaces a worksheet's items with `problemIds` in this order, positions positionAt(0), positionAt(1), …
   * One call, so the (worksheet, position) uniqueness never trips over a half-finished renumbering.
   */
  replaceItems(worksheetId: number, problemIds: number[]): Promise<void>;
}
