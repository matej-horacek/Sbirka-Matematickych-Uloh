import { Injectable } from '@nestjs/common';
import type { ChapterList, ChapterRef } from '@matematika/contracts';
import { ChaptersRepository } from '../repositories/chapters.repository';
import { toChapterNode, toChapterRef } from '../mappers/chapter.mapper';

/** Facade of the chapters module. */
@Injectable()
export class ChaptersService {
  constructor(private readonly repo: ChaptersRepository) {}

  /** Flat list; the frontend builds the tree from parentId. */
  list(userId: number): ChapterList {
    return { items: this.repo.findVisible(userId).map(toChapterNode) };
  }

  refsByIds(ids: number[]): Map<number, ChapterRef> {
    return new Map(this.repo.findByIds([...new Set(ids)]).map((c) => [c.id, toChapterRef(c)]));
  }

  /** The given chapters plus all their descendants (filtering by a parent includes its children). */
  withDescendants(ids: number[]): number[] {
    const all = this.repo.findAll();
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
  findNotUsable(userId: number, ids: number[]): number[] {
    const usable = new Set(this.repo.findVisible(userId).map((c) => c.id));
    return ids.filter((id) => !usable.has(id));
  }

  /** For copies: keeps only global chapters. */
  onlyGlobal(ids: number[]): number[] {
    return this.repo.findByIds(ids).filter((c) => c.isGlobal).map((c) => c.id);
  }
}
