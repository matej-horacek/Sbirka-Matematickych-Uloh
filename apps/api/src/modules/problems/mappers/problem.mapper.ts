import type {
  ChapterRef,
  LicenseRef,
  ProblemDetail,
  ProblemDetailCore,
  ProblemListItem,
  SourceRef,
  TagRef,
  UserRef,
} from '@matematika/contracts';
import type { ContentSourceRow, ProblemRow } from '../../../database/mock-database';
import { encodeId, encodeNullableId } from '../../../common/utils/ids';

/** Related data fetched in batches by the service, so the mapper never queries. */
export interface ProblemLookups {
  users: Map<number, UserRef>;
  tags: Map<number, TagRef>;
  chapters: Map<number, ChapterRef>;
  licenses: Map<number, LicenseRef>;
  childCounts: Map<number, number>;
}

function pick<T>(ids: number[], map: Map<number, T>): T[] {
  // A deleted tag or chapter is simply skipped: the app must not break on missing ids.
  return ids.map((id) => map.get(id)).filter((x): x is T => x !== undefined);
}

function toSource(source: ContentSourceRow, lk: ProblemLookups): SourceRef {
  return {
    type: source.originType,
    license: source.licenseId === null ? null : (lk.licenses.get(source.licenseId) ?? null),
    // OWN has no stored citation: the frontend builds it from `author`.
    // citation_audience only matters for anonymous share-code views (Phase C);
    // every caller of these endpoints is a logged-in teacher.
    citation: source.originType === 'OWN' ? null : source.sourceCitationText,
    licenseNote: source.licenseNote,
    showInWeb: source.showInWeb,
    showInPdf: source.showInPdf,
  };
}

export function toListItem(row: ProblemRow, lk: ProblemLookups): ProblemListItem {
  return {
    id: encodeId(row.id),
    name: row.name,
    assignment: row.assignment,
    result: row.result,
    language: row.languageCode,
    difficulty: row.difficulty,
    author: lk.users.get(row.authorId) ?? { id: encodeId(row.authorId), displayName: '?' },
    tags: pick(row.tagIds, lk.tags),
    chapters: pick(row.chapterIds, lk.chapters),
    childCount: lk.childCounts.get(row.id) ?? 0,
  };
}

export function toDetailCore(row: ProblemRow, lk: ProblemLookups): ProblemDetailCore {
  return {
    ...toListItem(row, lk),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    source: toSource(row.source, lk),
  };
}

/** A set child carries its own lockVersion, for its author only (R-008). */
function toChild(row: ProblemRow, lk: ProblemLookups, viewerId: number): ProblemDetailCore {
  return { ...toDetailCore(row, lk), ...(row.authorId === viewerId && { lockVersion: row.lockVersion }) };
}

export function toDetail(row: ProblemRow, children: ProblemRow[], lk: ProblemLookups, viewerId: number): ProblemDetail {
  const authorOnly =
    row.authorId === viewerId
      ? {
          status: row.publishStatus,
          version: row.version,
          lockVersion: row.lockVersion,
          originalId: encodeNullableId(row.originalProblemId),
        }
      : {};
  return {
    ...toDetailCore(row, lk),
    ...authorOnly,
    parentId: encodeNullableId(row.parentId),
    children: children.map((c) => toChild(c, lk, viewerId)),
  };
}
