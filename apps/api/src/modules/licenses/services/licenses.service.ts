import { Inject, Injectable } from '@nestjs/common';
import type { LicenseList, LicenseRef } from '@matematika/contracts';
import type { LicenseRow } from '../../../database/mock-database';
import { LICENSES_REPOSITORY, type LicensesRepository } from '../repositories/licenses.repository';
import { toLicense, toLicenseRef } from '../mappers/license.mapper';

/** Facade of the licenses module. */
@Injectable()
export class LicensesService {
  constructor(@Inject(LICENSES_REPOSITORY) private readonly repo: LicensesRepository) {}

  async listPublishable(): Promise<LicenseList> {
    return { items: (await this.repo.findPublishable()).map(toLicense) };
  }

  async findById(id: number): Promise<LicenseRow | undefined> {
    return (await this.repo.findByIds([id]))[0];
  }

  async rowsByIds(ids: number[]): Promise<Map<number, LicenseRow>> {
    return new Map((await this.repo.findByIds([...new Set(ids)])).map((l) => [l.id, l]));
  }

  async refsByIds(ids: number[]): Promise<Map<number, LicenseRef>> {
    return new Map([...(await this.rowsByIds(ids))].map(([id, row]) => [id, toLicenseRef(row)]));
  }
}
