import { Module } from '@nestjs/common';
import { TagsController } from './controllers/tags.controller';
import { MockTagsRepository } from './repositories/mock-tags.repository';
import { TAGS_REPOSITORY } from './repositories/tags.repository';
import { TagsService } from './services/tags.service';

@Module({
  controllers: [TagsController],
  providers: [{ provide: TAGS_REPOSITORY, useClass: MockTagsRepository }, TagsService],
  exports: [TagsService],
})
export class TagsModule {}
