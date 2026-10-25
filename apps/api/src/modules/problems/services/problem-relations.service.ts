import { Injectable } from '@nestjs/common';
import { ChaptersService } from '../../chapters/services/chapters.service';
import { TagsService } from '../../tags/services/tags.service';
import { decodeId } from '../../../common/utils/ids';
import { ApiError } from '../../../common/errors/api-error';

/** Turns tagIds / chapterIds from a request into checked integer ids. */
@Injectable()
export class ProblemRelationsService {
  constructor(
    private readonly tags: TagsService,
    private readonly chapters: ChaptersService,
  ) {}

  tagIds(userId: number, ids: string[] | undefined, field = 'tagIds'): number[] | undefined {
    if (ids === undefined) return undefined;
    const decoded = this.decodeAll(ids, field);
    if (this.tags.findNotUsable(userId, decoded).length) throw ApiError.badRequest(`${field}: unknown tag`);
    return decoded;
  }

  chapterIds(userId: number, ids: string[] | undefined, field = 'chapterIds'): number[] | undefined {
    if (ids === undefined) return undefined;
    const decoded = this.decodeAll(ids, field);
    if (this.chapters.findNotUsable(userId, decoded).length) throw ApiError.badRequest(`${field}: unknown chapter`);
    return decoded;
  }

  /** Copies keep only global tags and chapters, unless the caller owns the original. */
  forCopy(tagIds: number[], chapterIds: number[], callerOwnsOriginal: boolean) {
    if (callerOwnsOriginal) return { tagIds: [...tagIds], chapterIds: [...chapterIds] };
    return { tagIds: this.tags.onlyGlobal(tagIds), chapterIds: this.chapters.onlyGlobal(chapterIds) };
  }

  private decodeAll(ids: string[], field: string): number[] {
    return ids.map((value, i) => {
      const id = decodeId(value);
      if (id === null) throw ApiError.badRequest(`${field}.${i}: invalid id`);
      return id;
    });
  }
}
