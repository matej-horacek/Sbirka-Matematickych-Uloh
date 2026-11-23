import {Injectable} from "@nestjs/common";
import {PrismaService} from "../../../database/prisma.service.js";
import {type NewWorksheet, type WorksheetFilter, WorksheetsRepository} from "./worksheets.repository.js";
import type {WorksheetProblemRow, WorksheetRow} from "../../../database/mock-database.js";
import type {Prisma} from "../../../generated/prisma/client.js";
import {toChapterIds, toTagIds} from "../../../common/utils/relation-ids.js";

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

@Injectable()
export class PrismaWorksheetsRepository implements WorksheetsRepository {
  constructor(private readonly prismaService: PrismaService) {
  }




  async findById(id: number): Promise<WorksheetRow | undefined> {
    throw new Error("Not implemented");
  }

  async findByIds(ids: number[]): Promise<WorksheetRow[]> {
    throw new Error("Not implemented");
  }

  async findMany(filter: WorksheetFilter, page: number, limit: number): Promise<{ rows: WorksheetRow[]; total: number }> {
    throw new Error("Not implemented");
  }

  async insert(data: NewWorksheet): Promise<WorksheetRow> {
    throw new Error("Not implemented");
  }

  async update(id: number, data: Partial<WorksheetRow>): Promise<WorksheetRow> {
    throw new Error("Not implemented");
  }

  async updateIfLockVersion(
    id: number,
    expectedLockVersion: number,
    data: Partial<WorksheetRow>,
  ): Promise<WorksheetRow | null> {
    throw new Error("Not implemented");
  }

  async softDelete(ids: number[]): Promise<void> {
    throw new Error("Not implemented");
  }

  async incrementVersion(id: number): Promise<void> {
    throw new Error("Not implemented");
  }

  async findItems(_worksheetIds: number[]): Promise<WorksheetProblemRow[]> {
    throw new Error('Not implemented');
  }

  async replaceItems(_worksheetId: number, _problemIds: number[]): Promise<void> {
    throw new Error('Not implemented');
  }
}
