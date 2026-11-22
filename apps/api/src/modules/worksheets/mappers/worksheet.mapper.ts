import type { ChapterRef, TagRef, UserRef, WorksheetDetail, WorksheetListItem } from '@matematika/contracts';
import type { WorksheetRow } from '../../../database/mock-database.js';
import { encodeId } from '../../../common/utils/ids.js';

/** Related data fetched in batches by the service, so the mapper never queries. */
export interface WorksheetLookups {
  users: Map<number, UserRef>;
  tags: Map<number, TagRef>;
  chapters: Map<number, ChapterRef>;
}

function pick<T>(ids: number[], map: Map<number, T>): T[] {
  // A deleted tag or chapter is simply skipped: the app must not break on missing ids.
  return ids.map((id) => map.get(id)).filter((x): x is T => x !== undefined);
}

export function toListItem(row: WorksheetRow, lk: WorksheetLookups): WorksheetListItem {
  return {
    id: encodeId(row.id),
    name: row.name,
    language: row.languageCode,
    difficulty: row.difficulty,
    author: lk.users.get(row.authorId) ?? { id: encodeId(row.authorId), displayName: '?' },
    tags: pick(row.tagIds, lk.tags),
    chapters: pick(row.chapterIds, lk.chapters),
    // TODO: count worksheet_problem rows once items are stored.
    itemCount: 0,
  };
}

/** version and lockVersion are for the author only, like on problems. */
export function toDetail(row: WorksheetRow, lk: WorksheetLookups, viewerId: number): WorksheetDetail {
  return {
    ...toListItem(row, lk),
    status: row.publishStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.authorId === viewerId && { version: row.version, lockVersion: row.lockVersion }),
    // TODO: the worksheet's problems in order, once items are stored.
    items: [],
  };
}
