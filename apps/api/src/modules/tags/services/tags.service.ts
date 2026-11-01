import { Inject, Injectable } from '@nestjs/common';
import type { TagPage, TagRef } from '@matematika/contracts';
import { TAGS_REPOSITORY, type TagsRepository } from '../repositories/tags.repository';
import { toTagRef } from '../mappers/tag.mapper';

/** Facade of the tags module. */
@Injectable()
export class TagsService {
  constructor(@Inject(TAGS_REPOSITORY) private readonly repo: TagsRepository) {}

  async list(userId: number, q: string | undefined, page: number, limit: number): Promise<TagPage> {
    const all = await this.repo.findVisible(userId, q);
    const items = all.slice((page - 1) * limit, page * limit).map(toTagRef);
    return { items, meta: { page, limit, total: all.length } };
  }

  async refsByIds(ids: number[]): Promise<Map<number, TagRef>> {
    return new Map((await this.repo.findByIds([...new Set(ids)])).map((t) => [t.id, toTagRef(t)]));
  }

  /** Ids the user may attach: global or their own. Returns the ids that are not allowed. */
  async findNotUsable(userId: number, ids: number[]): Promise<number[]> {
    const usable = new Set((await this.repo.findVisible(userId)).map((t) => t.id));
    return ids.filter((id) => !usable.has(id));
  }

  /** For copies: keeps only global tags. */
  async onlyGlobal(ids: number[]): Promise<number[]> {
    return (await this.repo.findByIds(ids)).filter((t) => t.isGlobal).map((t) => t.id);
  }
}
