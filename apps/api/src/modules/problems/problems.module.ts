import { Module } from '@nestjs/common';
import { ChaptersModule } from '../chapters/chapters.module.js';
import { LicensesModule } from '../licenses/licenses.module.js';
import { TagsModule } from '../tags/tags.module.js';
import { UsersModule } from '../users/users.module.js';
import { ProblemsController } from './controllers/problems.controller.js';
import { repositoryProvider } from '../../config/data-source.js';
import { MockProblemsRepository } from './repositories/mock-problems.repository.js';
import { PrismaProblemsRepository } from './repositories/prisma-problems.repository.js';
import { PROBLEMS_REPOSITORY } from './repositories/problems.repository.js';
import { ProblemCopiesService } from './services/problem-copies.service.js';
import { ProblemRelationsService } from './services/problem-relations.service.js';
import { ProblemSetsService } from './services/problem-sets.service.js';
import { ProblemsService } from './services/problems.service.js';

@Module({
  imports: [UsersModule, TagsModule, ChaptersModule, LicensesModule],
  controllers: [ProblemsController],
  providers: [
    repositoryProvider(PROBLEMS_REPOSITORY, MockProblemsRepository, PrismaProblemsRepository),
    ProblemRelationsService,
    ProblemCopiesService,
    ProblemSetsService,
    ProblemsService,
  ],
  // Other modules get only the facade.
  exports: [ProblemsService],
})
export class ProblemsModule {}
