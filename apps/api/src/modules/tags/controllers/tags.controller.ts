import { Controller, Get, Query } from '@nestjs/common';
import type { TagPage } from '@matematika/contracts';
import { CurrentUser, type CurrentUserData } from '../../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import { listTagsQuery, type ListTagsQuery } from '../dto/list-tags.query.js';
import { TagsService } from '../services/tags.service.js';

@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  /** listTags – any logged-in teacher; global + own personal tags. */
  @Get()
  async list(
    @CurrentUser() user: CurrentUserData,
    @Query(new ZodValidationPipe(listTagsQuery)) query: ListTagsQuery,
  ): Promise<TagPage> {
    return this.tags.list(user.id, query.q, query.page, query.limit);
  }
}
