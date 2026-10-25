import { Injectable } from '@nestjs/common';
import type { TagPage, TagRef } from '@matematika/contracts';
import { TagsRepository } from '../repositories/tags.repository';
import { toTagRef } from '../mappers/tag.mapper';

/** Facade of the tags module. */
@Injectable()
export class TagsService {
  constructor(private readonly repo: TagsRepository) {}

  list(userId: number, q: string | undefined, page: number, limit: number): TagPage {
    const all = this.repo.findVisible(userId, q);
    const items = all.slice((page - 1) * limit, page * limit).map(toTagRef);
    return { items, meta: { page, limit, total: all.length } };
  }

  refsByIds(ids: number[]): Map<number, TagRef> {
    return new Map(this.repo.findByIds([...new Set(ids)]).map((t) => [t.id, toTagRef(t)]));
  }

  /** Ids the user may attach: global or their own. Returns the ids that are not allowed. */
  findNotUsable(userId: number, ids: number[]): number[] {
    const usable = new Set(this.repo.findVisible(userId).map((t) => t.id));
    return ids.filter((id) => !usable.has(id));
  }

  /** For copies: keeps only global tags. */
  onlyGlobal(ids: number[]): number[] {
    return this.repo.findByIds(ids).filter((t) => t.isGlobal).map((t) => t.id);
  }
}
