import { Injectable } from '@nestjs/common';
import { MockDatabase, type LicenseRow } from '../../../database/mock-database.js';
import type { LicensesRepository } from './licenses.repository.js';

@Injectable()
export class MockLicensesRepository implements LicensesRepository {
  constructor(private readonly db: MockDatabase) {}

  async findPublishable(): Promise<LicenseRow[]> {
    return this.db.licenses.filter((l) => l.allowsPublication);
  }

  async findByIds(ids: number[]): Promise<LicenseRow[]> {
    return this.db.licenses.filter((l) => ids.includes(l.id));
  }
}
