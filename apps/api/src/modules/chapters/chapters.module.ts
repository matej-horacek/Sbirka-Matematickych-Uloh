import { Module } from '@nestjs/common';
import { ChaptersController } from './controllers/chapters.controller';
import { CHAPTERS_REPOSITORY } from './repositories/chapters.repository';
import { MockChaptersRepository } from './repositories/mock-chapters.repository';
import { ChaptersService } from './services/chapters.service';

@Module({
  controllers: [ChaptersController],
  providers: [{ provide: CHAPTERS_REPOSITORY, useClass: MockChaptersRepository }, ChaptersService],
  exports: [ChaptersService],
})
export class ChaptersModule {}
