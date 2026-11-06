import { Injectable, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import type { LicenseRow } from '../../../database/mock-database.js';
import type { LicensesRepository } from './licenses.repository.js';

@Injectable()
export class PrismaLicensesRepository implements LicensesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * TODO Daniel. Must do (spec listLicenses):
   * - only licences with `allows_publication = true` (the picker never offers "all rights reserved");
   * - order: by id, so the picker keeps the seed order (CC0, CC BY, CC BY-SA);
   * - map snake_case columns to LicenseRow (requires_attribution → requiresAttribution, …).
   */
  async findPublishable(): Promise<LicenseRow[]> {
    throw new NotImplementedException('TODO Daniel');
  }

  /**
   * TODO Daniel. Must do:
   * - one query for all ids, INCLUDING licences with allows_publication = false
   *   (a problem may already carry one; publishing refuses it with LICENSE_REQUIRED);
   * - missing ids are simply absent from the result.
   */
  async findByIds(_ids: number[]): Promise<LicenseRow[]> {
    throw new NotImplementedException('TODO Daniel');
  }
}
