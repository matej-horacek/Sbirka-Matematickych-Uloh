import { Controller, Get } from '@nestjs/common';
import type { LicenseList } from '@matematika/contracts';
import { LicensesService } from '../services/licenses.service.js';

@Controller('licenses')
export class LicensesController {
  constructor(private readonly licenses: LicensesService) {}

  /** listLicenses – any logged-in teacher. */
  @Get()
  async list(): Promise<LicenseList> {
    return this.licenses.listPublishable();
  }
}
