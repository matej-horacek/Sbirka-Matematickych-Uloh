import { Injectable, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { TagRow } from '../../../database/mock-database';
import type { TagsRepository } from './tags.repository';

@Injectable()
export class PrismaTagsRepository implements TagsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * TODO Daniel. Must do (DECISIONS D-03, D-04; spec listTags):
   * - visibility: `is_global = true` OR `author_id = userId` (other people's personal tags are never visible);
   * - `q`: case-insensitive "contains" on name (`contains` + `mode: 'insensitive'`);
   * - sorted by name (no slug, no position column), Czech collation in mind: compare with the mock
   *   (`localeCompare(…, 'cs')`) and decide between a DB collation and sorting in code;
   * - map to TagRow: author_id → ownerId, is_global → isGlobal.
   * The caller paginates the returned array (page/limit/total), so return everything visible.
   */
  async findVisible(_userId: number, _q?: string): Promise<TagRow[]> {
    throw new NotImplementedException('TODO Daniel');
  }

  /**
   * TODO Daniel. Must do:
   * - one query for all ids, no visibility filter (the service decides what to keep);
   * - missing ids are simply absent from the result.
   */
  async findByIds(_ids: number[]): Promise<TagRow[]> {
    throw new NotImplementedException('TODO Daniel');
  }
}
