import {Injectable} from "@nestjs/common";
import {PrismaService} from "../../../database/prisma.service.js";
import {type NewWorksheet, type WorksheetFilter, WorksheetsRepository} from "./worksheets.repository.js";
import type { WorksheetProblemRow, WorksheetRow} from "../../../database/mock-database.js";
import type {Prisma, worksheet_problem} from "../../../generated/prisma/client.js";
import {toChapterIds, toTagIds} from "../../../common/utils/relation-ids.js";
import {comparePositions, positionAt} from "../../../common/utils/position.js";
import {ApiError} from "../../../common/errors/api-error.js";

export const WORKSHEET_INCLUDE = {
  language: true,
  worksheet_tag: { include: { tag: true } },
  worksheet_chapter: { include: { chapter: true } },
} satisfies Prisma.worksheetInclude;

export type WorksheetWithRelations = Prisma.worksheetGetPayload<{include: typeof WORKSHEET_INCLUDE}>

// type TagRelations = WorksheetWithRelations['worksheet_tag'];
// type ChapterRelations = WorksheetWithRelations['worksheet_chapter'];


// /** Tag ids sorted by tag name (D-04), Czech collation like the mock. */
// export function toTagIds(rows: TagLink[]): number[] {
//   return [...rows].sort((a, b) => a.tag.name.localeCompare(b.tag.name, 'cs')).map((r) => r.tag_id);
// }
//
// /** Chapter ids sorted by chapter name (D-04), Czech collation like the mock. */
// export function toChapterIds(rows: ChapterLink[]): number[] {
//   return [...rows].sort((a, b) => a.chapter.name.localeCompare(b.chapter.name, 'cs')).map((r) => r.chapter_id);
// }

/** DB worksheet (with its relations) → WorksheetRow. The relation parts are delegated to the mappers above. */
export function toWorksheetRow(p: WorksheetWithRelations): WorksheetRow {
  return {
    id: p.id,
    name: p.name,
    languageCode: p.language?.code ?? null,
    difficulty: p.difficulty,
    authorId: p.author_id,
    publishStatus: p.publish_status,
    version: p.version,
    lockVersion: p.lock_version,
    originalWorksheetId: p.original_worksheet_id,
    originalWorksheetVersion: p.original_worksheet_version,
    citationDisplay: p.citation_display,
    tagIds: toTagIds(p.worksheet_tag),
    chapterIds: toChapterIds(p.worksheet_chapter),
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    deletedAt: p.deleted_at,
  };
}

export function toWorksheetProblemRow(w: worksheet_problem): WorksheetProblemRow{
  return {
    worksheetId: w.worksheet_id,
    problemId: w.problem_id,
    position: w.position,
  };
}

@Injectable()
export class PrismaWorksheetsRepository implements WorksheetsRepository {
  constructor(private readonly prisma: PrismaService) {
  }

  // TODO: Move to shared helper
  private async languageId(tx: Prisma.TransactionClient, code: string | null): Promise<number | null> {
    if (code === null) return null;
    const language = await tx.language.findUnique({ where: { code } });
    if (!language) throw ApiError.badRequest(`language: unknown language code "${code}"`);
    return language.id;
  }


  async findById(id: number): Promise<WorksheetRow | undefined> {
    const row = await this.prisma.worksheet.findFirst({
      where: {id, deleted_at: null},
      include: WORKSHEET_INCLUDE
    });

    return row ? toWorksheetRow(row) : undefined;
  }

  async findByIds(ids: number[]): Promise<WorksheetRow[]> {
    const rows = await this.prisma.worksheet.findMany({
      where: {id: {in: ids}, deleted_at: null},
      include: WORKSHEET_INCLUDE,
    });

    return rows ? rows.map((w=> toWorksheetRow(w))) : [];
  }

  async findMany(filter: WorksheetFilter, page: number, limit: number): Promise<{ rows: WorksheetRow[]; total: number }> {
    const where: Prisma.worksheetWhereInput = {
      deleted_at: null,
      ...(filter.authorId !== undefined && { author_id: filter.authorId }),
      ...(filter.publishStatus !== undefined && { publish_status: filter.publishStatus }),
      ...(filter.tagIds?.length && { problem_tag: { some: { tag_id: { in: filter.tagIds } } } }),
      ...(filter.chapterIds?.length && { problem_chapter: { some: { chapter_id: { in: filter.chapterIds } } } }),
      ...(filter.languageCode !== undefined && { language: { is: { code: filter.languageCode } } }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.worksheet.findMany({
        where,
        include: WORKSHEET_INCLUDE,
        orderBy: [{ updated_at: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.worksheet.count({ where }),
    ]);
    return { rows: rows.map(toWorksheetRow), total };
  }

  async insert(data: NewWorksheet): Promise<WorksheetRow> {
    return this.prisma.$transaction(async (tx) => {
      const languageId = await this.languageId(tx, data.languageCode);
      const created = await tx.worksheet.create({
        data: {
          name: data.name,
          difficulty: data.difficulty,
          author_id: data.authorId,
          publish_status: data.publishStatus,
          version: data.version,
          lock_version: data.lockVersion,
          language_id: languageId,
        },
      });

      if (data.tagIds.length) {
        await tx.worksheet_tag.createMany({ data: data.tagIds.map((tag_id) => ({ worksheet_id: created.id, tag_id })) });
      }
      if (data.chapterIds.length) {
        await tx.worksheet_chapter.createMany({
          data: data.chapterIds.map((chapter_id) => ({ worksheet_id: created.id, chapter_id })),
        });
      }
      return toWorksheetRow(
        await tx.worksheet.findUniqueOrThrow({ where: { id: created.id }, include: WORKSHEET_INCLUDE }),
      );
    });
  }

  async update(id: number, data: Partial<WorksheetRow>): Promise<WorksheetRow> {
    return this.prisma.$transaction((tx) => this.applyPatch(tx, id, data));
  }

  async updateIfLockVersion(
    id: number,
    expectedLockVersion: number,
    data: Partial<WorksheetRow>,
  ): Promise<WorksheetRow | null> {
    const { lockVersion: _ignored, ...rest } = data;
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.worksheet.updateMany({
        where: { id, lock_version: expectedLockVersion, deleted_at: null },
        data: { lock_version: expectedLockVersion + 1 },
      });
      if (count === 0) return null;
      return this.applyPatch(tx, id, rest);
    });
  }

  private async applyPatch(tx: Prisma.TransactionClient, id: number, data: Partial<WorksheetRow>): Promise<WorksheetRow> {

    if (data.tagIds) {
      await tx.worksheet_tag.deleteMany({where: {worksheet_id: id}});
      if (data.tagIds.length) {
        await tx.worksheet_tag.createMany({data: data.tagIds.map((tag_id) => ({worksheet_id: id, tag_id}))});
      }
    }
    if (data.chapterIds) {
      await tx.worksheet_chapter.deleteMany({where: {worksheet_id: id}});
      if (data.chapterIds.length) {
        await tx.worksheet_chapter.createMany({
          data: data.chapterIds.map((chapter_id) => ({worksheet_id: id, chapter_id})),
        });
      }
    }

    return toWorksheetRow(await tx.worksheet.findUniqueOrThrow({where: {id}, include: WORKSHEET_INCLUDE}));
  }

  async softDelete(ids: number[]): Promise<void> {
    await this.prisma.worksheet.updateMany({
      where: { id: { in: ids }, deleted_at: null },
      data: { deleted_at: new Date() },
    });
  }

  async incrementVersion(id: number): Promise<void> {
    await this.prisma.worksheet.update({ where: { id }, data: { version: { increment: 1 } } });
  }

  async findItems(worksheetIds: number[]): Promise<WorksheetProblemRow[]> {
    const rows = await this.prisma.worksheet_problem.findMany({
      where: { worksheet_id: { in: worksheetIds } },
    });
    // Sorted in JS, not ORDER BY: Postgres collation may not be byte order (see comparePositions).
    return rows
      .map(toWorksheetProblemRow)
      .sort((a, b) => a.worksheetId - b.worksheetId || comparePositions(a.position, b.position));
  }

  async replaceItems(worksheetId: number, problemIds: number[]): Promise<void> {
    // Delete then insert in one transaction: no half-renumbered state can trip (worksheet_id, position) uniqueness.
    await this.prisma.$transaction([
      this.prisma.worksheet_problem.deleteMany({ where: { worksheet_id: worksheetId } }),
      this.prisma.worksheet_problem.createMany({
        data: problemIds.map((problem_id, index) => ({
          worksheet_id: worksheetId,
          problem_id,
          position: positionAt(index),
        })),
      }),
    ]);
  }
}
