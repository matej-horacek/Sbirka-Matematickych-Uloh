import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import type {ChapterRow} from '../../../database/mock-database.js';
import type { ChaptersRepository } from './chapters.repository.js';
import type {chapter} from '../../../generated/prisma/client.js';


@Injectable()
export class PrismaChaptersRepository implements ChaptersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * - visibility: `is_global = true` OR `author_id = userId`;
   * - exclude soft-deleted chapters (`deleted_at IS NULL`);
   * - a FLAT list sorted by name (the frontend builds the tree from parentId; no position column);
   * - map to ChapterRow: author_id → ownerId, is_global → isGlobal, parent_id → parentId.
   */
  async findVisible(userId: number): Promise<ChapterRow[]> {
    const rows = await this.prisma.chapter.findMany({
      where: {
        OR: [{author_id: userId}, { is_global: true }],
        deleted_at: null,
      },
      orderBy: {id: 'asc'}
    });
    return rows.map(toChapterRow).sort((a,b) => a.name.localeCompare(b.name, 'cs'));
  }


  /**
   * - one query for all ids, no visibility filter (the service decides what to keep);
   * - include soft-deleted chapters? NO: the mapper skips missing ids, so leave them out (`deleted_at IS NULL`).
   */
  async findByIds(ids: number[]): Promise<ChapterRow[]> {
    const rows = await this.prisma.chapter.findMany({
      where: {
        id: { in: ids },
        deleted_at: null,
      }
    });
    return rows.map(toChapterRow);
  }

  /**
   * - every non-deleted chapter, global and personal alike. ChaptersService.withDescendants walks
   *   `parentId` over this list, which is how "the chapter filter includes descendants" works
   *   (filtering by Rovnice also finds problems filed under Lineární rovnice).
   *   You may replace it with a recursive CTE later, but then change the interface and the service together.
   */
  async findAll(): Promise<ChapterRow[]> {
    const rows = await this.prisma.chapter.findMany({
      where: {deleted_at: null},
    });
    return rows.map(toChapterRow);
  }
}
/*
* Convert DB row to typescript acceptable type
* */
export function toChapterRow(c: chapter): ChapterRow{
  return {
    id: c.id,
    ownerId: c.author_id,
    parentId: c.parent_id,
    name:c.name,
    isGlobal: c.is_global,
  };
}
