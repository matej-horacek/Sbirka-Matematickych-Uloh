import { Module } from '@nestjs/common';
import { LicensesModule } from '../licenses/licenses.module';
import { ProblemsModule } from '../problems/problems.module';
import { PublicationController } from './controllers/publication.controller';
import { PublicationService } from './services/publication.service';

// TODO Phase B: revisions and review (problem_revision, approve/reject).
@Module({
  imports: [ProblemsModule, LicensesModule],
  controllers: [PublicationController],
  providers: [PublicationService],
})
export class PublicationModule {}
