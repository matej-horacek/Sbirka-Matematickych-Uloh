import { Injectable } from '@nestjs/common';
import { MockDatabase, type ChapterRow } from '../../../database/mock-database.js';
import type { ChaptersRepository } from './chapters.repository.js';

@Injectable()
export class MockChaptersRepository implements ChaptersRepository {
  constructor(private readonly db: MockDatabase) {}

  async findVisible(userId: number): Promise<ChapterRow[]> {
    return this.db.chapters
      .filter((c) => c.isGlobal || c.ownerId === userId)
      .sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  }

  async findByIds(ids: number[]): Promise<ChapterRow[]> {
    return this.db.chapters.filter((c) => ids.includes(c.id));
  }

  async findAll(): Promise<ChapterRow[]> {
    return this.db.chapters;
  }
}
