import { Inject, Injectable } from '@nestjs/common';
import type { WorksheetCreate, WorksheetDetail, WorksheetPage, WorksheetPatch } from '@matematika/contracts';
import { ErrorCode } from '@matematika/contracts';
import type { WorksheetRow } from '../../../database/mock-database.js';
import type { CurrentUserData } from '../../../common/decorators/current-user.decorator.js';
import { ApiError } from '../../../common/errors/api-error.js';
import { decodeId } from '../../../common/utils/ids.js';
import { ChaptersService } from '../../chapters/services/chapters.service.js';
import { TagsService } from '../../tags/services/tags.service.js';
import { UsersService } from '../../users/services/users.service.js';
import { canView } from '../domain/visibility.js';
import type { ListWorksheetsQuery } from '../dto/list-worksheets.query.js';
import { toDetail, toListItem, type WorksheetLookups } from '../mappers/worksheet.mapper.js';
import { WORKSHEETS_REPOSITORY, type WorksheetsRepository } from '../repositories/worksheets.repository.js';

/**
 * Facade of the worksheets module. Controllers call exactly one method here per request.
 * Items (POST/PATCH/DELETE /worksheets/{id}/items) are not built yet.
 */
@Injectable()
export class WorksheetsService {
  constructor(
    @Inject(WORKSHEETS_REPOSITORY) private readonly repo: WorksheetsRepository,
    private readonly users: UsersService,
    private readonly tags: TagsService,
    private readonly chapters: ChaptersService,
  ) {}

  // ---------- endpoints ----------

  /** Only the caller's own worksheets (D-40). Unknown filter ids are ignored, like on problems. */
  async list(user: CurrentUserData, q: ListWorksheetsQuery): Promise<WorksheetPage> {
    const tagIds = q.tagId?.map(decodeId).filter((id): id is number => id !== null);
    const chapterIds = q.chapterId?.map(decodeId).filter((id): id is number => id !== null);
    const { rows, total } = await this.repo.findMany(
      {
        authorId: user.id,
        tagIds,
        chapterIds: chapterIds && (await this.chapters.withDescendants(chapterIds)),
        languageCode: q.language,
      },
      q.page,
      q.limit,
    );
    const lk = await this.lookups(rows);
    return { items: rows.map((r) => toListItem(r, lk)), meta: { page: q.page, limit: q.limit, total } };
  }

  async get(user: CurrentUserData, id: number): Promise<WorksheetDetail> {
    return this.detail(await this.findVisible(user, id), user);
  }

  /** A new worksheet is empty, PRIVATE and has no licence (chosen when publishing). */
  async create(user: CurrentUserData, body: WorksheetCreate): Promise<WorksheetDetail> {
    const row = await this.repo.insert({
      name: body.name,
      languageCode: body.language ?? null,
      difficulty: body.difficulty ?? null,
      authorId: user.id,
      publishStatus: 'PRIVATE',
      citationDisplay: 'INLINE',
      version: 1,
      lockVersion: 1,
      originalWorksheetId: null,
      originalWorksheetVersion: null,
      tagIds: (await this.tagIds(user.id, body.tagIds)) ?? [],
      chapterIds: (await this.chapterIds(user.id, body.chapterIds)) ?? [],
    });
    return this.detail(row, user);
  }

  /**
   * Author only. Every PATCH raises lockVersion; version goes up only when name, difficulty or
   * language actually changes, not on tags or chapters alone (D-43).
   */
  async update(user: CurrentUserData, id: number, body: WorksheetPatch): Promise<WorksheetDetail> {
    const row = await this.findOwn(user, id);
    // Fast fail on a stale lock; the real guard is the atomic write below.
    if (body.lockVersion !== row.lockVersion) throw this.lockMismatch();

    const tagIds = await this.tagIds(user.id, body.tagIds);
    const chapterIds = await this.chapterIds(user.id, body.chapterIds);

    // PATCH semantics: a missing field stays unchanged, `null` clears it.
    const content: Partial<WorksheetRow> = {};
    if (body.name !== undefined) content.name = body.name;
    if (body.language !== undefined) content.languageCode = body.language;
    if (body.difficulty !== undefined) content.difficulty = body.difficulty;
    const contentChanged = (Object.keys(content) as (keyof WorksheetRow)[]).some((k) => content[k] !== row[k]);

    const updated = await this.repo.updateIfLockVersion(row.id, body.lockVersion, {
      ...content,
      ...(tagIds && { tagIds }),
      ...(chapterIds && { chapterIds }),
      ...(contentChanged && { version: row.version + 1 }),
    });
    if (!updated) throw this.lockMismatch();
    return this.detail(updated, user);
  }

  /** Author only. Soft delete; the worksheet's problems stay. */
  async remove(user: CurrentUserData, id: number): Promise<void> {
    const row = await this.findOwn(user, id);
    await this.repo.softDelete([row.id]);
  }

  // ---------- helpers ----------

  private lockMismatch(): ApiError {
    return ApiError.conflict(ErrorCode.LOCK_MISMATCH, 'Someone saved this worksheet in between. Reload and try again.');
  }

  /** 404 when the worksheet doesn't exist (or is deleted) or the caller can't see it. */
  private async findVisible(user: CurrentUserData, id: number): Promise<WorksheetRow> {
    const row = await this.repo.findById(id);
    if (!row || !canView(row, user.id)) throw ApiError.notFound();
    return row;
  }

  /** Author only: others get 403 on a published worksheet and 404 on a private one. */
  private async findOwn(user: CurrentUserData, id: number): Promise<WorksheetRow> {
    const row = await this.findVisible(user, id);
    if (row.authorId !== user.id) throw ApiError.forbidden();
    return row;
  }

  private async detail(row: WorksheetRow, user: CurrentUserData): Promise<WorksheetDetail> {
    return toDetail(row, await this.lookups([row]), user.id);
  }

  /** Batch-loads everything the mapper needs: one lookup per related table. */
  private async lookups(rows: WorksheetRow[]): Promise<WorksheetLookups> {
    return {
      users: await this.users.refsByIds(rows.map((r) => r.authorId)),
      tags: await this.tags.refsByIds(rows.flatMap((r) => r.tagIds)),
      chapters: await this.chapters.refsByIds(rows.flatMap((r) => r.chapterIds)),
    };
  }

  /** Request tag ids → checked integer ids; undefined when the field was not sent. */
  private async tagIds(userId: number, ids: string[] | undefined): Promise<number[] | undefined> {
    if (ids === undefined) return undefined;
    const decoded = this.decodeAll(ids, 'tagIds');
    if ((await this.tags.findNotUsable(userId, decoded)).length) throw ApiError.badRequest('tagIds: unknown tag');
    return decoded;
  }

  private async chapterIds(userId: number, ids: string[] | undefined): Promise<number[] | undefined> {
    if (ids === undefined) return undefined;
    const decoded = this.decodeAll(ids, 'chapterIds');
    if ((await this.chapters.findNotUsable(userId, decoded)).length) {
      throw ApiError.badRequest('chapterIds: unknown chapter');
    }
    return decoded;
  }

  private decodeAll(ids: string[], field: string): number[] {
    return ids.map((value, i) => {
      const id = decodeId(value);
      if (id === null) throw ApiError.badRequest(`${field}.${i}: invalid id`);
      return id;
    });
  }
}
