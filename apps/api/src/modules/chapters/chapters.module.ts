import { Module } from '@nestjs/common';
import { ChaptersController } from './controllers/chapters.controller';
import { ChaptersRepository } from './repositories/chapters.repository';
import { ChaptersService } from './services/chapters.service';

@Module({
  controllers: [ChaptersController],
  providers: [ChaptersRepository, ChaptersService],
  exports: [ChaptersService],
})
export class ChaptersModule {}
