import { Controller, Get } from '@nestjs/common';
import type { ChapterList } from '@matematika/contracts';
import { CurrentUser, type CurrentUserData } from '../../../common/decorators/current-user.decorator';
import { ChaptersService } from '../services/chapters.service';

@Controller('chapters')
export class ChaptersController {
  constructor(private readonly chapters: ChaptersService) {}

  /** listChapters – any logged-in teacher; global + own personal chapters. */
  @Get()
  list(@CurrentUser() user: CurrentUserData): ChapterList {
    return this.chapters.list(user.id);
  }
}
