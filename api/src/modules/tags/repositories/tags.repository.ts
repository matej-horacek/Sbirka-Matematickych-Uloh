import { Injectable } from '@nestjs/common';
import { MockDatabase, type TagRow } from '../../../database/mock-database';

@Injectable()
export class TagsRepository {
  constructor(private readonly db: MockDatabase) {}

  /** Global tags plus the user's own personal ones. */
  findVisible(userId: number, q?: string): TagRow[] {
    const needle = q?.toLocaleLowerCase('cs');
    return this.db.tags
      .filter((t) => t.isGlobal || t.ownerId === userId)
      .filter((t) => !needle || t.name.toLocaleLowerCase('cs').includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  }

  findByIds(ids: number[]): TagRow[] {
    return this.db.tags.filter((t) => ids.includes(t.id));
  }
}
