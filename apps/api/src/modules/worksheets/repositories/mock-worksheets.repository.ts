import { Injectable } from '@nestjs/common';
import { comparePositions, positionAt } from '../../../common/utils/position.js';
import { MockDatabase, type WorksheetProblemRow, type WorksheetRow } from '../../../database/mock-database.js';
import type { NewWorksheet, WorksheetFilter, WorksheetsRepository } from './worksheets.repository.js';


@Injectable()
export class MockWorksheetsRepository implements WorksheetsRepository {
  constructor(private readonly db: MockDatabase) {}

  private get alive() {
    return this.db.worksheets.filter((w) => w.deletedAt === null);
  }

  async findById(id: number): Promise<WorksheetRow | undefined> {
    return this.alive.find((p) => p.id === id);
  }

  async findByIds(ids: number[]): Promise<WorksheetRow[]> {
    return this.alive.filter((c) => ids.includes(c.id));
  }

  async findMany(filter: WorksheetFilter, page: number, limit: number): Promise<{ rows: WorksheetRow[]; total: number }> {
    const matching = this.alive
      .filter((p) => filter.authorId === undefined || p.authorId === filter.authorId)
      .filter((p) => filter.publishStatus === undefined || p.publishStatus === filter.publishStatus)
      .filter((p) => !filter.tagIds?.length || p.tagIds.some((t) => filter.tagIds!.includes(t)))
      .filter((p) => !filter.chapterIds?.length || p.chapterIds.some((c) => filter.chapterIds!.includes(c)))
      .filter((p) => filter.languageCode === undefined || p.languageCode === filter.languageCode)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return { rows: matching.slice((page - 1) * limit, page * limit), total: matching.length };
  }

  async insert(data: NewWorksheet): Promise<WorksheetRow> {
    const now = new Date();
    const row: WorksheetRow = {...data, id: this.db.newWorksheetId(), createdAt: now, updatedAt: now, deletedAt: null}
    this.db.worksheets.push(row);
    return this.db.sortRelations(row);
  }

  async update(id: number, data: Partial<WorksheetRow>): Promise<WorksheetRow> {
    const row = this.db.worksheets.find((p) => p.id === id)!;
    Object.assign(row, data, { updatedAt: new Date() });
    return this.db.sortRelations(row);
  }

  async updateIfLockVersion(
    id: number,
    expectedLockVersion: number,
    data: Partial<WorksheetRow>,
  ): Promise<WorksheetRow | null> {
    const row = this.alive.find((p) => p.id === id);
    if (!row || row.lockVersion !== expectedLockVersion) return null;
    Object.assign(row, data, { lockVersion: expectedLockVersion + 1, updatedAt: new Date() });
    return this.db.sortRelations(row);
  }

  async softDelete(ids: number[]): Promise<void> {
    const now = new Date();
    for (const p of this.db.worksheets) if (ids.includes(p.id)) p.deletedAt = now;
  }

  async incrementVersion(id: number): Promise<void> {
    const row = this.db.worksheets.find((p) => p.id === id)!;
    row.version += 1;
    row.updatedAt = new Date();
  }

  async findItems(worksheetIds: number[]): Promise<WorksheetProblemRow[]> {
    return this.db.worksheetProblems
      .filter((i) => worksheetIds.includes(i.worksheetId))
      .sort((a, b) => a.worksheetId - b.worksheetId || comparePositions(a.position, b.position))
      .map((i) => ({ ...i })); // copies, so a caller can't change the store by accident
  }

  async replaceItems(worksheetId: number, problemIds: number[]): Promise<void> {
    this.db.worksheetProblems = [
      ...this.db.worksheetProblems.filter((i) => i.worksheetId !== worksheetId),
      ...problemIds.map((problemId, index) => ({ worksheetId, problemId, position: positionAt(index) })),
    ];
  }
}
