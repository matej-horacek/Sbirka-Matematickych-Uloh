import { Injectable } from '@nestjs/common';
import { ApiError } from '../../../common/errors/api-error.js';
import { positionAt } from '../../../common/utils/position.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { ContentSourceRow, ProblemRow } from '../../../database/mock-database.js';
import {
  comparePositions,
  type NewProblem,
  type ProblemFilter,
  type ProblemsRepository,
} from './problems.repository.js';
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

/** ContentSourceRow fields that are present → content_source columns (for create and update). */
function toSourceData(source: Partial<ContentSourceRow>) {
  return {
    ...(source.originType !== undefined && { origin_type: source.originType }),
    ...(source.sourceCitationText !== undefined && { source_citation_text: source.sourceCitationText }),
    ...(source.licenseId !== undefined && { license_id: source.licenseId }),
    ...(source.licenseNote !== undefined && { license_note: source.licenseNote }),
    ...(source.citationAudience !== undefined && { citation_audience: source.citationAudience }),
    ...(source.showInWeb !== undefined && { show_in_web: source.showInWeb }),
    ...(source.showInPdf !== undefined && { show_in_pdf: source.showInPdf }),
  };
}

/**
 * problem_part.position is NOT NULL and unique per parent. A problem that is put into a set without a
 * position (the sets service renumbers right after) gets this placeholder, unique because the id is.
 * '~' sorts after every real key ('a…'), so a forgotten placeholder would show up last, not first.
 */
const placeholderPosition = (problemId: number) => `~${problemId}`;

@Injectable()
export class PrismaProblemsRepository implements ProblemsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** language.code → language.id. A problem's language is free text in the API, so an unknown code is a 400. */
  private async languageId(tx: Prisma.TransactionClient, code: string | null): Promise<number | null> {
    if (code === null) return null;
    const language = await tx.language.findUnique({ where: { code } });
    if (!language) throw ApiError.badRequest(`language: unknown language code "${code}"`);
    return language.id;
  }

  /** A live (not soft-deleted) problem by id. No visibility check: ProblemsService applies canView. */
  async findById(id: number): Promise<ProblemRow | undefined> {
    const problem = await this.prisma.problem.findFirst({
      where: { id, deleted_at: null },
      include: PROBLEM_INCLUDE,
    });
    return problem ? toProblemRow(problem) : undefined;
  }

  /**
   * Live children of a set, in BYTE order of their position (comparePositions): positions are
   * case-sensitive fractional-indexing keys, so the sort happens here and not in a locale-dependent query (R-020).
   */
  async findChildren(parentId: number): Promise<ProblemRow[]> {
    const rows = await this.prisma.problem.findMany({
      where: { deleted_at: null, problem_part_problem_part_child_idToproblem: { is: { parent_id: parentId } } },
      include: PROBLEM_INCLUDE,
    });
    return rows.map(toProblemRow).sort((a, b) => comparePositions(a.position ?? '', b.position ?? ''));
  }

  /** One grouped query; every requested id is in the Map, 0 when it has no live children. */
  async countChildren(parentIds: number[]): Promise<Map<number, number>> {
    const counts = new Map(parentIds.map((id) => [id, 0]));
    if (parentIds.length === 0) return counts;
    const groups = await this.prisma.problem_part.groupBy({
      by: ['parent_id'],
      where: { parent_id: { in: parentIds }, problem_problem_part_child_idToproblem: { deleted_at: null } },
      _count: { _all: true },
    });
    for (const g of groups) counts.set(g.parent_id, g._count._all);
    return counts;
  }

  /**
   * Top-level problems only (a set's children never appear in lists), newest first (updated_at DESC, id DESC so
   * paging is stable). `total` counts all matching rows, not just this page. The chapter list is already expanded
   * to descendants by ChaptersService, so the chapter filter is a plain `in`.
   */
  async findMany(filter: ProblemFilter, page: number, limit: number): Promise<{ rows: ProblemRow[]; total: number }> {
    const where: Prisma.problemWhereInput = {
      deleted_at: null,
      problem_part_problem_part_child_idToproblem: { is: null },
      ...(filter.authorId !== undefined && { author_id: filter.authorId }),
      ...(filter.publishStatus !== undefined && { publish_status: filter.publishStatus }),
      ...(filter.tagIds?.length && { problem_tag: { some: { tag_id: { in: filter.tagIds } } } }),
      ...(filter.chapterIds?.length && { problem_chapter: { some: { chapter_id: { in: filter.chapterIds } } } }),
      ...(filter.languageCode !== undefined && { language: { is: { code: filter.languageCode } } }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.problem.findMany({
        where,
        include: PROBLEM_INCLUDE,
        orderBy: [{ updated_at: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.problem.count({ where }),
    ]);
    return { rows: rows.map(toProblemRow), total };
  }

  /** One transaction: content_source → problem → tag, chapter and (for a set child) problem_part rows. */
  async insert(data: NewProblem): Promise<ProblemRow> {
    return this.prisma.$transaction(async (tx) => {
      const languageId = await this.languageId(tx, data.languageCode);
      const source = await tx.content_source.create({
        data: {
          origin_type: data.source.originType,
          source_citation_text: data.source.sourceCitationText,
          license_id: data.source.licenseId,
          license_note: data.source.licenseNote,
          citation_audience: data.source.citationAudience,
          show_in_web: data.source.showInWeb,
          show_in_pdf: data.source.showInPdf,
        },
      });
      const created = await tx.problem.create({
        data: {
          name: data.name,
          assignment: data.assignment,
          result: data.result,
          difficulty: data.difficulty,
          author_id: data.authorId,
          publish_status: data.publishStatus,
          version: data.version,
          lock_version: data.lockVersion,
          original_problem_id: data.originalProblemId,
          original_problem_version: data.originalProblemVersion,
          language_id: languageId,
          source_id: source.id,
        },
      });
      if (data.tagIds.length) {
        await tx.problem_tag.createMany({ data: data.tagIds.map((tag_id) => ({ problem_id: created.id, tag_id })) });
      }
      if (data.chapterIds.length) {
        await tx.problem_chapter.createMany({
          data: data.chapterIds.map((chapter_id) => ({ problem_id: created.id, chapter_id })),
        });
      }
      if (data.parentId !== null) {
        await tx.problem_part.create({
          data: {
            parent_id: data.parentId,
            child_id: created.id,
            position: data.position ?? placeholderPosition(created.id),
          },
        });
      }
      return toProblemRow(
        await tx.problem.findUniqueOrThrow({ where: { id: created.id }, include: PROBLEM_INCLUDE }),
      );
    });
  }

  /**
   * Patches only the keys present in `data`. tagIds / chapterIds replace the join rows; parentId null removes the
   * problem from its set, a parentId puts it in one (without a position: placeholder, see renumberChildren);
   * `source` patches the content_source row. updated_at is bumped on every call, like the mock does.
   */
  async update(id: number, data: Partial<ProblemRow>): Promise<ProblemRow> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.problem.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.assignment !== undefined && { assignment: data.assignment }),
          ...(data.result !== undefined && { result: data.result }),
          ...(data.difficulty !== undefined && { difficulty: data.difficulty }),
          ...(data.authorId !== undefined && { author_id: data.authorId }),
          ...(data.publishStatus !== undefined && { publish_status: data.publishStatus }),
          ...(data.version !== undefined && { version: data.version }),
          ...(data.lockVersion !== undefined && { lock_version: data.lockVersion }),
          ...(data.originalProblemId !== undefined && { original_problem_id: data.originalProblemId }),
          ...(data.originalProblemVersion !== undefined && { original_problem_version: data.originalProblemVersion }),
          ...(data.deletedAt !== undefined && { deleted_at: data.deletedAt }),
          ...(data.languageCode !== undefined && { language_id: await this.languageId(tx, data.languageCode) }),
        },
      });

      if (data.source) {
        const sourceData = toSourceData(data.source);
        if (Object.keys(sourceData).length) {
          await tx.content_source.update({ where: { id: updated.source_id }, data: sourceData });
        }
      }

      if (data.tagIds) {
        await tx.problem_tag.deleteMany({ where: { problem_id: id } });
        if (data.tagIds.length) {
          await tx.problem_tag.createMany({ data: data.tagIds.map((tag_id) => ({ problem_id: id, tag_id })) });
        }
      }
      if (data.chapterIds) {
        await tx.problem_chapter.deleteMany({ where: { problem_id: id } });
        if (data.chapterIds.length) {
          await tx.problem_chapter.createMany({
            data: data.chapterIds.map((chapter_id) => ({ problem_id: id, chapter_id })),
          });
        }
      }

      if (data.parentId === null) {
        await tx.problem_part.deleteMany({ where: { child_id: id } });
      } else if (data.parentId !== undefined) {
        const existing = await tx.problem_part.findUnique({ where: { child_id: id } });
        // Same parent keeps its position; a new parent (or none given) gets the placeholder.
        const position =
          data.position ?? (existing?.parent_id === data.parentId ? existing.position : placeholderPosition(id));
        await tx.problem_part.upsert({
          where: { child_id: id },
          create: { parent_id: data.parentId, child_id: id, position },
          update: { parent_id: data.parentId, position },
        });
      } else if (typeof data.position === 'string') {
        await tx.problem_part.updateMany({ where: { child_id: id }, data: { position: data.position } });
      }

      return toProblemRow(await tx.problem.findUniqueOrThrow({ where: { id }, include: PROBLEM_INCLUDE }));
    });
  }

  /** Soft delete: deleted_at = now() on every given id in one updateMany. Unknown or deleted ids are ignored. */
  async softDelete(ids: number[]): Promise<void> {
    await this.prisma.problem.updateMany({
      where: { id: { in: ids }, deleted_at: null },
      data: { deleted_at: new Date() },
    });
  }

  /**
   * positionAt(0..n-1) in the given order. (parent_id, position) is UNIQUE and not deferrable, so writing the
   * final keys one by one can collide with a sibling that still holds the key (e.g. inserting at index 0).
   * Two phases in one transaction: first every child gets its unique placeholder, then the final key.
   */
  async renumberChildren(parentId: number, orderedChildIds: number[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const id of orderedChildIds) {
        await tx.problem_part.updateMany({
          where: { parent_id: parentId, child_id: id },
          data: { position: placeholderPosition(id) },
        });
      }
      for (const [i, id] of orderedChildIds.entries()) {
        await tx.problem_part.updateMany({
          where: { parent_id: parentId, child_id: id },
          data: { position: positionAt(i) },
        });
      }
    });
  }
}
