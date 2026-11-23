import type {
  ChapterRef,
  ProblemDetail,
  TagRef,
  UserRef,
  WorksheetDetail,
  WorksheetListItem,
} from '@matematika/contracts';
import type { WorksheetRow } from '../../../database/mock-database.js';
import { encodeId } from '../../../common/utils/ids.js';

/** Related data fetched in batches by the service, so the mapper never queries. */
export interface WorksheetLookups {
  users: Map<number, UserRef>;
  tags: Map<number, TagRef>;
  chapters: Map<number, ChapterRef>;
  /** Live items per worksheet id (deleted problems are not counted). */
  itemCounts: Map<number, number>;
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
    itemCount: lk.itemCounts.get(row.id) ?? 0,
  };
}

/**
 * `items` are the worksheet's live problems in worksheet order (the service leaves out deleted ones).
 * version and lockVersion are for the author only, like on problems.
 */
export function toDetail(
  row: WorksheetRow,
  items: ProblemDetail[],
  lk: WorksheetLookups,
  viewerId: number,
): WorksheetDetail {
  return {
    ...toListItem(row, lk),
    itemCount: items.length,
    status: row.publishStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.authorId === viewerId && { version: row.version, lockVersion: row.lockVersion }),
    items: items.map((problem) => ({ kind: 'PROBLEM' as const, problem })),
  };
}
