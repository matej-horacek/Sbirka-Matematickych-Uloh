import { Module } from '@nestjs/common';
import { WorksheetsService } from './services/worksheets.service.js';
import { WorksheetsController } from './controllers/worksheets.controller.js';
import { repositoryProvider} from "../../config/data-source.js";
import { WORKSHEETS_REPOSITORY} from "./repositories/worksheets.repository.js";
import { MockWorksheetsRepository} from "./repositories/mock-worksheets.repository.js";
import { PrismaWorksheetsRepository } from "./repositories/prisma-worksheets.repository.js";
import { ChaptersModule } from '../chapters/chapters.module.js';
import { TagsModule } from '../tags/tags.module.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [UsersModule, TagsModule, ChaptersModule],
  controllers: [WorksheetsController],
  providers: [
    repositoryProvider(WORKSHEETS_REPOSITORY, MockWorksheetsRepository, PrismaWorksheetsRepository),
    WorksheetsService,
  ],
  exports: [WorksheetsService],
})
export class WorksheetsModule {}
