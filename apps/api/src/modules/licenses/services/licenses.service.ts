import { Injectable } from '@nestjs/common';
import type { LicenseList, LicenseRef } from '@matematika/contracts';
import type { LicenseRow } from '../../../database/mock-database';
import { LicensesRepository } from '../repositories/licenses.repository';
import { toLicense, toLicenseRef } from '../mappers/license.mapper';

/** Facade of the licenses module. */
@Injectable()
export class LicensesService {
  constructor(private readonly repo: LicensesRepository) {}

  listPublishable(): LicenseList {
    return { items: this.repo.findPublishable().map(toLicense) };
  }

  findById(id: number): LicenseRow | undefined {
    return this.repo.findByIds([id])[0];
  }

  rowsByIds(ids: number[]): Map<number, LicenseRow> {
    return new Map(this.repo.findByIds([...new Set(ids)]).map((l) => [l.id, l]));
  }

  refsByIds(ids: number[]): Map<number, LicenseRef> {
    return new Map([...this.rowsByIds(ids)].map(([id, row]) => [id, toLicenseRef(row)]));
  }
}
