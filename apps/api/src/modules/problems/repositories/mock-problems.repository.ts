import { Injectable } from '@nestjs/common';
import { positionAt } from '../../../common/utils/position.js';
import { MockDatabase, type ProblemRow } from '../../../database/mock-database.js';
import {
  comparePositions,
  type NewProblem,
  type ProblemFilter,
  type ProblemsRepository,
} from './problems.repository.js';

@Injectable()
export class MockProblemsRepository implements ProblemsRepository {
  constructor(private readonly db: MockDatabase) {}

  private get alive() {
    return this.db.problems.filter((p) => p.deletedAt === null);
  }

  async findById(id: number): Promise<ProblemRow | undefined> {
    return this.alive.find((p) => p.id === id);
  }

  async findChildren(parentId: number): Promise<ProblemRow[]> {
    return this.alive
      .filter((p) => p.parentId === parentId)
      .sort((a, b) => comparePositions(a.position ?? '', b.position ?? ''));
  }

  async countChildren(parentIds: number[]): Promise<Map<number, number>> {
    const counts = new Map(parentIds.map((id) => [id, 0]));
    for (const p of this.alive) {
      if (p.parentId !== null && counts.has(p.parentId)) counts.set(p.parentId, counts.get(p.parentId)! + 1);
    }
    return counts;
  }

  async findMany(filter: ProblemFilter, page: number, limit: number): Promise<{ rows: ProblemRow[]; total: number }> {
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

  async insert(data: NewProblem): Promise<ProblemRow> {
    const now = new Date();
    const row: ProblemRow = { ...data, id: this.db.newProblemId(), createdAt: now, updatedAt: now, deletedAt: null };
    this.db.problems.push(row);
    return this.db.sortRelations(row);
  }

  async update(id: number, data: Partial<ProblemRow>): Promise<ProblemRow> {
    const row = this.db.problems.find((p) => p.id === id)!;
    Object.assign(row, data, { updatedAt: new Date() });
    return this.db.sortRelations(row);
  }

  async softDelete(ids: number[]): Promise<void> {
    const now = new Date();
    for (const p of this.db.problems) if (ids.includes(p.id)) p.deletedAt = now;
  }

  async renumberChildren(_parentId: number, orderedChildIds: number[]): Promise<void> {
    for (const [i, id] of orderedChildIds.entries()) await this.update(id, { position: positionAt(i) });
  }
}
