import { Module } from '@nestjs/common';
import { LicensesController } from './controllers/licenses.controller';
import { LicensesRepository } from './repositories/licenses.repository';
import { LicensesService } from './services/licenses.service';

@Module({
  controllers: [LicensesController],
  providers: [LicensesRepository, LicensesService],
  exports: [LicensesService],
})
export class LicensesModule {}
