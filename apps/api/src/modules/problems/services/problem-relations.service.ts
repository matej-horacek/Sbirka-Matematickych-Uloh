import { Injectable } from '@nestjs/common';
import { ChaptersService } from '../../chapters/services/chapters.service.js';
import { TagsService } from '../../tags/services/tags.service.js';
import { decodeId } from '../../../common/utils/ids.js';
import { ApiError } from '../../../common/errors/api-error.js';

/** Turns tagIds / chapterIds from a request into checked integer ids. */
@Injectable()
export class ProblemRelationsService {
  constructor(
    private readonly tags: TagsService,
    private readonly chapters: ChaptersService,
  ) {}

  async tagIds(userId: number, ids: string[] | undefined, field = 'tagIds'): Promise<number[] | undefined> {
    if (ids === undefined) return undefined;
    const decoded = this.decodeAll(ids, field);
    if ((await this.tags.findNotUsable(userId, decoded)).length) throw ApiError.badRequest(`${field}: unknown tag`);
    return decoded;
  }

  async chapterIds(userId: number, ids: string[] | undefined, field = 'chapterIds'): Promise<number[] | undefined> {
    if (ids === undefined) return undefined;
    const decoded = this.decodeAll(ids, field);
    if ((await this.chapters.findNotUsable(userId, decoded)).length) throw ApiError.badRequest(`${field}: unknown chapter`);
    return decoded;
  }

  /** Copies keep only global tags and chapters, unless the caller owns the original. */
  async forCopy(tagIds: number[], chapterIds: number[], callerOwnsOriginal: boolean) {
    if (callerOwnsOriginal) return { tagIds: [...tagIds], chapterIds: [...chapterIds] };
    return { tagIds: await this.tags.onlyGlobal(tagIds), chapterIds: await this.chapters.onlyGlobal(chapterIds) };
  }

  private decodeAll(ids: string[], field: string): number[] {
    return ids.map((value, i) => {
      const id = decodeId(value);
      if (id === null) throw ApiError.badRequest(`${field}.${i}: invalid id`);
      return id;
    });
  }
}
