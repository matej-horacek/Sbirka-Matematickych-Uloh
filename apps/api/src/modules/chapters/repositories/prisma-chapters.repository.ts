import { Injectable, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { ChapterRow } from '../../../database/mock-database';
import type { ChaptersRepository } from './chapters.repository';

@Injectable()
export class PrismaChaptersRepository implements ChaptersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * TODO Daniel. Must do (DECISIONS D-03, D-04; spec listChapters):
   * - visibility: `is_global = true` OR `author_id = userId`;
   * - exclude soft-deleted chapters (`deleted_at IS NULL`);
   * - a FLAT list sorted by name (the frontend builds the tree from parentId; no position column);
   * - map to ChapterRow: author_id → ownerId, is_global → isGlobal, parent_id → parentId.
   */
  async findVisible(_userId: number): Promise<ChapterRow[]> {
    throw new NotImplementedException('TODO Daniel');
  }

  /**
   * TODO Daniel. Must do:
   * - one query for all ids, no visibility filter (the service decides what to keep);
   * - include soft-deleted chapters? NO: the mapper skips missing ids, so leave them out (`deleted_at IS NULL`).
   */
  async findByIds(_ids: number[]): Promise<ChapterRow[]> {
    throw new NotImplementedException('TODO Daniel');
  }

  /**
   * TODO Daniel. Must do:
   * - every non-deleted chapter, global and personal alike. ChaptersService.withDescendants walks
   *   `parentId` over this list, which is how "the chapter filter includes descendants" works
   *   (filtering by Rovnice also finds problems filed under Lineární rovnice).
   *   You may replace it with a recursive CTE later, but then change the interface and the service together.
   */
  async findAll(): Promise<ChapterRow[]> {
    throw new NotImplementedException('TODO Daniel');
  }
}
