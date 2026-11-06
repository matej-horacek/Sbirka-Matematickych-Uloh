import type { License, LicenseRef } from '@matematika/contracts';
import type { LicenseRow } from '../../../database/mock-database.js';
import { encodeId } from '../../../common/utils/ids.js';

export function toLicenseRef(row: LicenseRow): LicenseRef {
  return { id: encodeId(row.id), name: row.name, url: row.url };
}

export function toLicense(row: LicenseRow): License {
  return {
    ...toLicenseRef(row),
    description: row.description,
    requiresAttribution: row.requiresAttribution,
    allowsModification: row.allowsModification,
    requiresShareAlike: row.requiresShareAlike,
  };
}
