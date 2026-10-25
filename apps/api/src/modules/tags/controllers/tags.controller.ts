import { Controller, Get, Query } from '@nestjs/common';
import type { TagPage } from '@matematika/contracts';
import { CurrentUser, type CurrentUserData } from '../../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { listTagsQuery, type ListTagsQuery } from '../dto/list-tags.query';
import { TagsService } from '../services/tags.service';

@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  /** listTags – any logged-in teacher; global + own personal tags. */
  @Get()
  list(
    @CurrentUser() user: CurrentUserData,
    @Query(new ZodValidationPipe(listTagsQuery)) query: ListTagsQuery,
  ): TagPage {
    return this.tags.list(user.id, query.q, query.page, query.limit);
  }
}
