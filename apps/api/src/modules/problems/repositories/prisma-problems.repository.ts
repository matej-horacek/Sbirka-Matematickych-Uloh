import { Injectable, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import type { ContentSourceRow, ProblemRow } from '../../../database/mock-database.js';
import type { NewProblem, ProblemFilter, ProblemsRepository } from './problems.repository.js';
import type { Prisma } from '../../../generated/prisma/client.js';

/*
 * Mapping every method below has to do between the DB and ProblemRow (see mock-database.ts):
 *  - languageCode  = language.code (via language_id; null when language_id is null);
 *  - parentId + position come from problem_part (child_id = this problem); a standalone problem has both null;
 *  - source        = the problem's content_source row (1:1 via source_id), as ContentSourceRow;
 *  - tagIds        = problem_tag.tag_id, SORTED BY tag.name (D-04: no position column);
 *  - chapterIds    = problem_chapter.chapter_id, SORTED BY chapter.name (D-04);
 *  - originalProblemId/Version = original_problem_id / original_problem_version;
 *  - Timestamps are timestamptz (D-02); updated_at is maintained by Prisma @updatedAt.
 */

/**
 * Every relation a ProblemRow needs. EVERY query that returns a problem must pass this as `include`,
 * otherwise `toProblemRow` does not compile (its parameter type is derived from this constant).
 * The tag and chapter rows are included with their parent record, because we sort by its name.
 */
export const PROBLEM_INCLUDE = {
  language: true,
  content_source: true,
  problem_part_problem_part_child_idToproblem: true, // parent_id + position, null for a standalone problem
  problem_tag: { include: { tag: true } },
  problem_chapter: { include: { chapter: true } },
} satisfies Prisma.problemInclude;

/** A problem row plus all the relations from PROBLEM_INCLUDE (the type Prisma returns for that include). */
export type ProblemWithRelations = Prisma.problemGetPayload<{ include: typeof PROBLEM_INCLUDE }>;

/* Parts of ProblemWithRelations, named so the small mappers below stay readable. */
type SourceRelation = ProblemWithRelations['content_source'];
type PartRelation = ProblemWithRelations['problem_part_problem_part_child_idToproblem'];
type TagRelations = ProblemWithRelations['problem_tag'];
type ChapterRelations = ProblemWithRelations['problem_chapter'];

/** content_source (snake_case) → ContentSourceRow (camelCase). The DB `id` is not part of the row. */
export function toSourceRow(cs: SourceRelation): ContentSourceRow {
  return {
    originType: cs.origin_type,
    sourceCitationText: cs.source_citation_text,
    licenseId: cs.license_id,
    licenseNote: cs.license_note,
    citationAudience: cs.citation_audience,
    showInWeb: cs.show_in_web,
    showInPdf: cs.show_in_pdf,
  };
}

/** problem_part → where the problem sits in a set. A standalone problem has no row, so both are null. */
export function toPlacement(part: PartRelation): Pick<ProblemRow, 'parentId' | 'position'> {
  return {
    parentId: part?.parent_id ?? null,
    position: part?.position ?? null,
  };
}

/** Tag ids sorted by tag name (D-04), Czech collation like the mock. */
export function toTagIds(rows: TagRelations): number[] {
  return [...rows].sort((a, b) => a.tag.name.localeCompare(b.tag.name, 'cs')).map((r) => r.tag_id);
}

/** Chapter ids sorted by chapter name (D-04), Czech collation like the mock. */
export function toChapterIds(rows: ChapterRelations): number[] {
  return [...rows].sort((a, b) => a.chapter.name.localeCompare(b.chapter.name, 'cs')).map((r) => r.chapter_id);
}

/** DB problem (with its relations) → ProblemRow. The relation parts are delegated to the mappers above. */
export function toProblemRow(p: ProblemWithRelations): ProblemRow {
  return {
    id: p.id,
    name: p.name,
    assignment: p.assignment,
    result: p.result,
    languageCode: p.language?.code ?? null,
    difficulty: p.difficulty,
    authorId: p.author_id,
    publishStatus: p.publish_status,
    version: p.version,
    lockVersion: p.lock_version,
    ...toPlacement(p.problem_part_problem_part_child_idToproblem),
    originalProblemId: p.original_problem_id,
    originalProblemVersion: p.original_problem_version,
    source: toSourceRow(p.content_source),
    tagIds: toTagIds(p.problem_tag),
    chapterIds: toChapterIds(p.problem_chapter),
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    deletedAt: p.deleted_at,
  };
}

@Injectable()
export class PrismaProblemsRepository implements ProblemsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * - find by id with `deleted_at IS NULL` (a soft-deleted problem is "not found");
   * - NO visibility check here: ProblemsService applies canView (author sees all theirs, others only
   *   PUBLISHED; others' private problems must look like 404);
   * - include language, content_source, problem_part (as child), problem_tag and problem_chapter (see mapping above).
   */
  async findById(id: number): Promise<ProblemRow | undefined> {
    const problem = await this.prisma.problem.findFirst({
      where: { id: id },
      include: PROBLEM_INCLUDE,
    });
    return problem ? toProblemRow(problem): undefined;
  }

  /**
   * TODO Daniel. Must do:
   * - live (deleted_at IS NULL) problems whose problem_part.parent_id = parentId;
   * - ORDER BY problem_part.position in BYTE order, not locale order: positions are fractional-indexing keys,
   *   case-sensitive ('aB' < 'ab'). Use a "C" collation (e.g. `position COLLATE "C"` via $queryRaw) or sort in
   *   code with comparePositions; Prisma's plain orderBy follows the DB collation and can get this wrong (R-020).
   */
  async findChildren(_parentId: number): Promise<ProblemRow[]> {
    throw new NotImplementedException('TODO Daniel');
  }

  /**
   * TODO Daniel. Must do:
   * - one grouped query: count live children (problem.deleted_at IS NULL) per problem_part.parent_id;
   * - EVERY requested id must be in the Map, with 0 when it has no children.
   */
  async countChildren(_parentIds: number[]): Promise<Map<number, number>> {
    throw new NotImplementedException('TODO Daniel');
  }

  /**
   * TODO Daniel. Must do (spec listProblems, DECISIONS D-04):
   * - only live (deleted_at IS NULL) TOP-LEVEL problems: no problem_part row with child_id = problem.id;
   * - authorId → author_id; publishStatus → publish_status (scope=mine uses authorId, any other scope PUBLISHED);
   * - tagIds: has AT LEAST ONE of these tags (problem_tag `some`);
   * - chapterIds: in at least one of these chapters. The list is ALREADY expanded to descendants by
   *   ChaptersService.withDescendants, so the filter itself is just `some: { chapter_id: { in } }`;
   * - languageCode → language.code;
   * - ORDER BY updated_at DESC (then id DESC so paging is stable);
   * - page/limit → skip/take, and `total` = count of ALL matching rows (not just this page): use a transaction
   *   or Promise.all for findMany + count with the same `where`.
   */
  async findMany(
    _filter: ProblemFilter,
    _page: number,
    _limit: number,
  ): Promise<{ rows: ProblemRow[]; total: number }> {
    throw new NotImplementedException('TODO Daniel');
  }

  /**
   * TODO Daniel. Must do, in ONE transaction ($transaction; all or nothing):
   *  1. create the content_source row (origin_type, source_citation_text, license_id, license_note,
   *     citation_audience, show_in_web, show_in_pdf);
   *  2. create the problem with source_id = that row (language via code → language_id; author_id; publish_status;
   *     version, lock_version, original_problem_id/version);
   *  3. create the join rows: problem_tag, problem_chapter, and problem_part when parentId is set
   *     (parent_id, child_id = new id, position);
   * - return the stored problem mapped to ProblemRow (id and timestamps come from the DB).
   * Copies of sets are inserted child by child by ProblemCopiesService, each call being its own transaction.
   */
  async insert(_data: NewProblem): Promise<ProblemRow> {
    throw new NotImplementedException('TODO Daniel');
  }

  /**
   * TODO Daniel. Must do (one transaction when several tables change):
   * - patch only the keys present in `data` (Partial<ProblemRow>); `updatedAt` is NOT sent, @updatedAt sets it;
   * - `tagIds` / `chapterIds` present → REPLACE the join rows (delete + createMany), absent → leave untouched;
   * - `parentId` / `position` present → upsert or delete the problem_part row (null parentId = delete the row);
   * - `source` present → update the content_source row (licenseId is how publishing stores the chosen licence);
   * - `publishStatus` → publish_status, `languageCode` → language_id via language.code;
   * - lockVersion / version are written as given (the service has already checked the lock and computed them);
   * - return the updated problem mapped to ProblemRow.
   */
  async update(_id: number, _data: Partial<ProblemRow>): Promise<ProblemRow> {
    throw new NotImplementedException('TODO Daniel');
  }

  /**
   * TODO Daniel. Must do:
   * - set deleted_at = now() on every given id (soft delete, rows stay; join rows stay too);
   * - already-deleted or unknown ids are ignored (idempotent);
   * - the service passes a set together with its children in one call, so do it in one updateMany.
   */
  async softDelete(_ids: number[]): Promise<void> {
    throw new NotImplementedException('TODO Daniel');
  }
}
