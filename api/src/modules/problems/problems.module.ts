import { Module } from '@nestjs/common';
import { ChaptersModule } from '../chapters/chapters.module';
import { LicensesModule } from '../licenses/licenses.module';
import { TagsModule } from '../tags/tags.module';
import { UsersModule } from '../users/users.module';
import { ProblemsController } from './controllers/problems.controller';
import { ProblemsRepository } from './repositories/problems.repository';
import { ProblemCopiesService } from './services/problem-copies.service';
import { ProblemRelationsService } from './services/problem-relations.service';
import { ProblemSetsService } from './services/problem-sets.service';
import { ProblemsService } from './services/problems.service';

@Module({
  imports: [UsersModule, TagsModule, ChaptersModule, LicensesModule],
  controllers: [ProblemsController],
  providers: [ProblemsRepository, ProblemRelationsService, ProblemCopiesService, ProblemSetsService, ProblemsService],
  // Other modules get only the facade.
  exports: [ProblemsService],
})
export class ProblemsModule {}
