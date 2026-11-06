import { Module } from '@nestjs/common';
import { LicensesModule } from '../licenses/licenses.module.js';
import { ProblemsModule } from '../problems/problems.module.js';
import { PublicationController } from './controllers/publication.controller.js';
import { PublicationService } from './services/publication.service.js';

// TODO Phase B: revisions and review (problem_revision, approve/reject).
@Module({
  imports: [ProblemsModule, LicensesModule],
  controllers: [PublicationController],
  providers: [PublicationService],
})
export class PublicationModule {}
