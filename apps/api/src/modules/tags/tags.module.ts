import { Module } from '@nestjs/common';
import { TagsController } from './controllers/tags.controller.js';
import { repositoryProvider } from '../../config/data-source.js';
import { MockTagsRepository } from './repositories/mock-tags.repository.js';
import { PrismaTagsRepository } from './repositories/prisma-tags.repository.js';
import { TAGS_REPOSITORY } from './repositories/tags.repository.js';
import { TagsService } from './services/tags.service.js';

@Module({
  controllers: [TagsController],
  providers: [repositoryProvider(TAGS_REPOSITORY, MockTagsRepository, PrismaTagsRepository), TagsService],
  exports: [TagsService],
})
export class TagsModule {}
