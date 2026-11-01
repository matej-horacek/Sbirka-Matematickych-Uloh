import { Module } from '@nestjs/common';
import { TagsController } from './controllers/tags.controller';
import { repositoryProvider } from '../../config/data-source';
import { MockTagsRepository } from './repositories/mock-tags.repository';
import { PrismaTagsRepository } from './repositories/prisma-tags.repository';
import { TAGS_REPOSITORY } from './repositories/tags.repository';
import { TagsService } from './services/tags.service';

@Module({
  controllers: [TagsController],
  providers: [repositoryProvider(TAGS_REPOSITORY, MockTagsRepository, PrismaTagsRepository), TagsService],
  exports: [TagsService],
})
export class TagsModule {}
