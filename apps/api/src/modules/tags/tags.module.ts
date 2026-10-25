import { Module } from '@nestjs/common';
import { TagsController } from './controllers/tags.controller';
import { TagsRepository } from './repositories/tags.repository';
import { TagsService } from './services/tags.service';

@Module({
  controllers: [TagsController],
  providers: [TagsRepository, TagsService],
  exports: [TagsService],
})
export class TagsModule {}
