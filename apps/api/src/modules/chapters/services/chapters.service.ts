import { Inject, Injectable } from '@nestjs/common';
import type { ChapterList, ChapterRef } from '@matematika/contracts';
import { CHAPTERS_REPOSITORY, type ChaptersRepository } from '../repositories/chapters.repository.js';
import { toChapterNode, toChapterRef } from '../mappers/chapter.mapper.js';

/** Facade of the chapters module. */
@Injectable()
export class ChaptersService {
  constructor(@Inject(CHAPTERS_REPOSITORY) private readonly repo: ChaptersRepository) {}

  /** Flat list; the frontend builds the tree from parentId. */
  async list(userId: number): Promise<ChapterList> {
    return { items: (await this.repo.findVisible(userId)).map(toChapterNode) };
  }

  async refsByIds(ids: number[]): Promise<Map<number, ChapterRef>> {
    return new Map((await this.repo.findByIds([...new Set(ids)])).map((c) => [c.id, toChapterRef(c)]));
  }

  /** The given chapters plus all their descendants (filtering by a parent includes its children). */
  async withDescendants(ids: number[]): Promise<number[]> {
    const all = await this.repo.findAll();
    const result = new Set(ids);
    let added = true;
    while (added) {
      added = false;
      for (const c of all) {
        if (c.parentId !== null && result.has(c.parentId) && !result.has(c.id)) {
          result.add(c.id);
          added = true;
        }
      }
    }
    return [...result];
  }

  /** Ids the user may attach: global or their own. Returns the ids that are not allowed. */
  async findNotUsable(userId: number, ids: number[]): Promise<number[]> {
    const usable = new Set((await this.repo.findVisible(userId)).map((c) => c.id));
    return ids.filter((id) => !usable.has(id));
  }

  /** For copies: keeps only global chapters. */
  async onlyGlobal(ids: number[]): Promise<number[]> {
    return (await this.repo.findByIds(ids)).filter((c) => c.isGlobal).map((c) => c.id);
  }
}
