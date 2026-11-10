import { Module } from '@nestjs/common';
import { ChaptersController } from './controllers/chapters.controller.js';
import { CHAPTERS_REPOSITORY } from './repositories/chapters.repository.js';
import { repositoryProvider } from '../../config/data-source.js';
import { MockChaptersRepository } from './repositories/mock-chapters.repository.js';
import { PrismaChaptersRepository } from './repositories/prisma-chapters.repository.js';
import { ChaptersService } from './services/chapters.service.js';

@Module({
  controllers: [ChaptersController],
  providers: [
    repositoryProvider(CHAPTERS_REPOSITORY, MockChaptersRepository, PrismaChaptersRepository),
    ChaptersService,
  ],
  exports: [ChaptersService],
})
export class ChaptersModule {}
