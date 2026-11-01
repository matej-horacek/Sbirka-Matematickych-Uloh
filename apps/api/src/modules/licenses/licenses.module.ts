import { Module } from '@nestjs/common';
import { LicensesController } from './controllers/licenses.controller';
import { LICENSES_REPOSITORY } from './repositories/licenses.repository';
import { MockLicensesRepository } from './repositories/mock-licenses.repository';
import { LicensesService } from './services/licenses.service';

@Module({
  controllers: [LicensesController],
  providers: [{ provide: LICENSES_REPOSITORY, useClass: MockLicensesRepository }, LicensesService],
  exports: [LicensesService],
})
export class LicensesModule {}
