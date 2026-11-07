import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import type { TagRow } from '../../../database/mock-database.js';
import type { TagsRepository } from './tags.repository.js';
import type { tag } from '../../../generated/prisma/client.js';

@Injectable()
export class PrismaTagsRepository implements TagsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * - visibility: `is_global = true` OR `author_id = userId` (other people's personal tags are never visible);
   * - `q`: case-insensitive "contains" on name (`contains` + `mode: 'insensitive'`);
   * - sorted by name (no slug, no position column), Czech collation in mind: compare with the mock
   *   (`localeCompare(…, 'cs')`) and decide between a DB collation and sorting in code;
   * - map to TagRow: author_id → ownerId, is_global → isGlobal.
   * The caller paginates the returned array (page/limit/total), so return everything visible.
   */
  async findVisible(userId: number, q?: string): Promise<TagRow[]> {
    const rows = await this.prisma.tag.findMany({
      where: {
        OR: [{author_id: userId}, { is_global: true }],
        name: q ? { contains: q, mode: 'insensitive'} : undefined,
      },
      orderBy: {id: 'asc'}
    });
    return rows.map(toTagRow).sort((a,b) => a.name.localeCompare(b.name, 'cs'));
  }

  /**
   * - one query for all ids, no visibility filter (the service decides what to keep);
   * - missing ids are simply absent from the result.
   */
  async findByIds(ids: number[]): Promise<TagRow[]> {
    const rows = await this.prisma.tag.findMany({
      where: {
        id: { in: ids }
      },
      orderBy: {id: 'asc'}
    });
    return rows.map(toTagRow);
  }
}

export function toTagRow(t: tag): TagRow{
  return {
    id: t.id,
    name: t.name,
    isGlobal: t.is_global,
    ownerId: t.author_id,
  };
}
