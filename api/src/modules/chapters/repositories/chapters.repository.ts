import { Injectable } from '@nestjs/common';
import { MockDatabase, type ChapterRow } from '../../../database/mock-database';

@Injectable()
export class ChaptersRepository {
  constructor(private readonly db: MockDatabase) {}

  /** Global chapters plus the user's own personal ones, sorted by name. */
  findVisible(userId: number): ChapterRow[] {
    return this.db.chapters
      .filter((c) => c.isGlobal || c.ownerId === userId)
      .sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  }

  findByIds(ids: number[]): ChapterRow[] {
    return this.db.chapters.filter((c) => ids.includes(c.id));
  }

  findAll(): ChapterRow[] {
    return this.db.chapters;
  }
}
