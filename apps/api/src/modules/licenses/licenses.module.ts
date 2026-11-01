import { Module } from '@nestjs/common';
import { LicensesController } from './controllers/licenses.controller';
import { LICENSES_REPOSITORY } from './repositories/licenses.repository';
import { repositoryProvider } from '../../config/data-source';
import { MockLicensesRepository } from './repositories/mock-licenses.repository';
import { PrismaLicensesRepository } from './repositories/prisma-licenses.repository';
import { LicensesService } from './services/licenses.service';

@Module({
  controllers: [LicensesController],
  providers: [repositoryProvider(LICENSES_REPOSITORY, MockLicensesRepository, PrismaLicensesRepository), LicensesService],
  exports: [LicensesService],
})
export class LicensesModule {}
