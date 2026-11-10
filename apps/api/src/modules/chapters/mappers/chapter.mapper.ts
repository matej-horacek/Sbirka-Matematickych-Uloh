import type { ChapterNode, ChapterRef } from '@matematika/contracts';
import type { ChapterRow } from '../../../database/mock-database.js';
import { encodeId, encodeNullableId } from '../../../common/utils/ids.js';

export function toChapterRef(row: ChapterRow): ChapterRef {
  return { id: encodeId(row.id), name: row.name, scope: row.isGlobal ? 'global' : 'personal' };
}

export function toChapterNode(row: ChapterRow): ChapterNode {
  return { ...toChapterRef(row), parentId: encodeNullableId(row.parentId) };
}
