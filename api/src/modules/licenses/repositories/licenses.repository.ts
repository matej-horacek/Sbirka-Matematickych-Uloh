import { Injectable } from '@nestjs/common';
import { MockDatabase, type LicenseRow } from '../../../database/mock-database';

@Injectable()
export class LicensesRepository {
  constructor(private readonly db: MockDatabase) {}

  findPublishable(): LicenseRow[] {
    return this.db.licenses.filter((l) => l.allowsPublication);
  }

  findByIds(ids: number[]): LicenseRow[] {
    return this.db.licenses.filter((l) => ids.includes(l.id));
  }
}
