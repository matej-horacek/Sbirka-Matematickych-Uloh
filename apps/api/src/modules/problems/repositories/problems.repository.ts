import { Injectable } from '@nestjs/common';
import { MockDatabase, type ProblemRow } from '../../../database/mock-database';

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

// Only data access, no decisions. Phase B: same methods, Prisma inside.
@Injectable()
export class ProblemsRepository {
  constructor(private readonly db: MockDatabase) {}

  private get alive() {
    return this.db.problems.filter((p) => p.deletedAt === null);
  }

  findById(id: number): ProblemRow | undefined {
    return this.alive.find((p) => p.id === id);
  }

  findChildren(parentId: number): ProblemRow[] {
    return this.alive
      .filter((p) => p.parentId === parentId)
      .sort((a, b) => (a.position ?? '').localeCompare(b.position ?? ''));
  }

  countChildren(parentIds: number[]): Map<number, number> {
    const counts = new Map(parentIds.map((id) => [id, 0]));
    for (const p of this.alive) {
      if (p.parentId !== null && counts.has(p.parentId)) counts.set(p.parentId, counts.get(p.parentId)! + 1);
    }
    return counts;
  }

  /** Top-level problems only (set children never appear in lists), newest first. */
  findMany(filter: ProblemFilter, page: number, limit: number): { rows: ProblemRow[]; total: number } {
    const matching = this.alive
      .filter((p) => p.parentId === null)
      .filter((p) => filter.authorId === undefined || p.authorId === filter.authorId)
      .filter((p) => filter.publishStatus === undefined || p.publishStatus === filter.publishStatus)
      .filter((p) => !filter.tagIds?.length || p.tagIds.some((t) => filter.tagIds!.includes(t)))
      .filter((p) => !filter.chapterIds?.length || p.chapterIds.some((c) => filter.chapterIds!.includes(c)))
      .filter((p) => filter.languageCode === undefined || p.languageCode === filter.languageCode)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return { rows: matching.slice((page - 1) * limit, page * limit), total: matching.length };
  }

  insert(data: NewProblem): ProblemRow {
    const now = new Date();
    const row: ProblemRow = { ...data, id: this.db.newProblemId(), createdAt: now, updatedAt: now, deletedAt: null };
    this.db.problems.push(row);
    return row;
  }

  update(id: number, data: Partial<ProblemRow>): ProblemRow {
    const row = this.db.problems.find((p) => p.id === id)!;
    Object.assign(row, data, { updatedAt: new Date() });
    return row;
  }

  softDelete(ids: number[]): void {
    const now = new Date();
    for (const p of this.db.problems) if (ids.includes(p.id)) p.deletedAt = now;
  }
}
