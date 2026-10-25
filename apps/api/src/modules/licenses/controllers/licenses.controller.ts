import { Controller, Get } from '@nestjs/common';
import type { LicenseList } from '@matematika/contracts';
import { LicensesService } from '../services/licenses.service';

@Controller('licenses')
export class LicensesController {
  constructor(private readonly licenses: LicensesService) {}

  /** listLicenses – any logged-in teacher. */
  @Get()
  list(): LicenseList {
    return this.licenses.listPublishable();
  }
}
