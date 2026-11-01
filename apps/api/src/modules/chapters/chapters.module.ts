import { Module } from '@nestjs/common';
import { ChaptersController } from './controllers/chapters.controller';
import { CHAPTERS_REPOSITORY } from './repositories/chapters.repository';
import { repositoryProvider } from '../../config/data-source';
import { MockChaptersRepository } from './repositories/mock-chapters.repository';
import { PrismaChaptersRepository } from './repositories/prisma-chapters.repository';
import { ChaptersService } from './services/chapters.service';

@Module({
  controllers: [ChaptersController],
  providers: [repositoryProvider(CHAPTERS_REPOSITORY, MockChaptersRepository, PrismaChaptersRepository), ChaptersService],
  exports: [ChaptersService],
})
export class ChaptersModule {}
