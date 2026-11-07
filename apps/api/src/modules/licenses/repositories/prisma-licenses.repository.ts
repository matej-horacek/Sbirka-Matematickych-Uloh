import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import type { LicenseRow } from '../../../database/mock-database.js';
import type { LicensesRepository } from './licenses.repository.js';
import type { license } from '../../../generated/prisma/client.js';

@Injectable()
export class PrismaLicensesRepository implements LicensesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * - only licences with `allows_publication = true` (the picker never offers "all rights reserved");
   * - order: by id, so the picker keeps the seed order (CC0, CC BY, CC BY-SA);
   * - map snake_case columns to LicenseRow (requires_attribution → requiresAttribution, …).
   */
  async findPublishable(): Promise<LicenseRow[]> {
    const rows = await this.prisma.license.findMany({
      where: { allows_publication: true },
      orderBy: { id: 'asc' },
    });

    return rows.map(toLicenseRow);
  }

  /**
   * - one query for all ids, INCLUDING licences with allows_publication = false
   *   (a problem may already carry one; publishing refuses it with LICENSE_REQUIRED);
   * - missing ids are simply absent from the result.
   */
  async findByIds(ids: number[]): Promise<LicenseRow[]> {
    const rows = await this.prisma.license.findMany({
      where: { id: { in: ids } },
    });

    return rows.map(toLicenseRow);
  }
}
/*
 * - converts queried records into LicenceRow type
 * */
export function toLicenseRow(l: license): LicenseRow {
  return {
    id: l.id,
    name: l.name,
    description: l.description,
    url: l.url,
    requiresAttribution: l.requires_attribution,
    allowsModification: l.allows_modification,
    requiresShareAlike: l.requires_share_alike,
    allowsPublication: l.allows_publication,
  };
}
