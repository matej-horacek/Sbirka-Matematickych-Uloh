import { Injectable } from '@nestjs/common';
import { MockDatabase, type TagRow } from '../../../database/mock-database.js';
import type { TagsRepository } from './tags.repository.js';

@Injectable()
export class MockTagsRepository implements TagsRepository {
  constructor(private readonly db: MockDatabase) {}

  async findVisible(userId: number, q?: string): Promise<TagRow[]> {
    const needle = q?.toLocaleLowerCase('cs');
    return this.db.tags
      .filter((t) => t.isGlobal || t.ownerId === userId)
      .filter((t) => !needle || t.name.toLocaleLowerCase('cs').includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  }

  async findByIds(ids: number[]): Promise<TagRow[]> {
    return this.db.tags.filter((t) => ids.includes(t.id));
  }
}
