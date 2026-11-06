import type { TagRef } from '@matematika/contracts';
import type { TagRow } from '../../../database/mock-database.js';
import { encodeId } from '../../../common/utils/ids.js';

export function toTagRef(row: TagRow): TagRef {
  return { id: encodeId(row.id), name: row.name, scope: row.isGlobal ? 'global' : 'personal' };
}
