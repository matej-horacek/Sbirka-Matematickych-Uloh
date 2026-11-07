import { Module } from '@nestjs/common';
import { LicensesController } from './controllers/licenses.controller.js';
import { LICENSES_REPOSITORY } from './repositories/licenses.repository.js';
import { repositoryProvider } from '../../config/data-source.js';
import { MockLicensesRepository } from './repositories/mock-licenses.repository.js';
import { PrismaLicensesRepository } from './repositories/prisma-licenses.repository.js';
import { LicensesService } from './services/licenses.service.js';

@Module({
  controllers: [LicensesController],
  providers: [
    repositoryProvider(LICENSES_REPOSITORY, MockLicensesRepository, PrismaLicensesRepository),
    LicensesService,
  ],
  exports: [LicensesService],
})
export class LicensesModule {}
