import type { TagRef } from '../../../contracts';
import type { TagRow } from '../../../database/mock-database';
import { encodeId } from '../../../common/utils/ids';

export function toTagRef(row: TagRow): TagRef {
  return { id: encodeId(row.id), name: row.name, scope: row.isGlobal ? 'global' : 'personal' };
}
