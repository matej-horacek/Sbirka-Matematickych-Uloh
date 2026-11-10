import type { LicenseRow } from '../../../database/mock-database.js';

export const LICENSES_REPOSITORY = Symbol('LICENSES_REPOSITORY');

/** Data access for licences. Only queries, no decisions. Implementations: Mock…, Prisma… */
export interface LicensesRepository {
  /** Licences with allowsPublication = true (the picker list). */
  findPublishable(): Promise<LicenseRow[]>;
  findByIds(ids: number[]): Promise<LicenseRow[]>;
}
