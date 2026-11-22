import { Inject, Injectable } from '@nestjs/common';
import type {
  AddItemRequest,
  ReorderItemRequest,
  WorksheetCreate,
  WorksheetDetail,
  WorksheetPage,
  WorksheetPatch,
} from '@matematika/contracts';
import { ErrorCode } from '@matematika/contracts';
import type { WorksheetRow } from '../../../database/mock-database.js';
import type { CurrentUserData } from '../../../common/decorators/current-user.decorator.js';
import { ApiError } from '../../../common/errors/api-error.js';
import { decodeId } from '../../../common/utils/ids.js';
import { parseIfMatch } from '../../../common/utils/if-match.js';
import { ChaptersService } from '../../chapters/services/chapters.service.js';
import { ProblemsService } from '../../problems/services/problems.service.js';
import { TagsService } from '../../tags/services/tags.service.js';
import { UsersService } from '../../users/services/users.service.js';
import { canView } from '../domain/visibility.js';
import type { ListWorksheetsQuery } from '../dto/list-worksheets.query.js';
import { toDetail, toListItem, type WorksheetLookups } from '../mappers/worksheet.mapper.js';
import { WORKSHEETS_REPOSITORY, type WorksheetsRepository } from '../repositories/worksheets.repository.js';

/**
 * Facade of the worksheets module. Controllers call exactly one method here per request.
 * Problems are reached only through ProblemsService (the problems module's facade).
 */
@Injectable()
export class WorksheetsService {
  constructor(
    @Inject(WORKSHEETS_REPOSITORY) private readonly repo: WorksheetsRepository,
    private readonly problems: ProblemsService,
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

  // ---------- items ----------
  // An item is a link (worksheet, problem, position). Every save writes the whole new order
  // (replaceItems), like set children. Raises lockVersion and version (D-43).

  /**
   * addWorksheetItem. Your own top-level problem goes in as a reference (D-32); anyone else's visible
   * problem is copied first and the copy goes in (D-27). afterId: missing = end, null = first.
   */
  async addItem(user: CurrentUserData, id: number, body: AddItemRequest): Promise<WorksheetDetail> {
    const ws = await this.findOwn(user, id);
    if (body.lockVersion !== ws.lockVersion) throw this.lockMismatch();

    const problemId = decodeId(body.problemId);
    if (problemId === null) throw ApiError.notFound();
    const problem = await this.problems.findVisibleRow(user, problemId); // 404 when not visible
    if (problem.parentId !== null) {
      throw ApiError.conflict(ErrorCode.IS_SET_CHILD, 'A set child cannot be added on its own. Add its set.');
    }
    const own = problem.authorId === user.id;
    const order = await this.liveItemIds(ws.id);
    if (own && order.includes(problem.id)) {
      throw ApiError.conflict(ErrorCode.ALREADY_IN_WORKSHEET, 'This problem is already in the worksheet.');
    }
    const insertAt = body.afterId === undefined ? order.length : this.indexAfter(order, body.afterId);

    // Claim the lock before copying, so a stale request never leaves an orphan copy behind.
    const updated = await this.claimLock(ws, body.lockVersion, this.lockMismatch());
    const itemId = own ? problem.id : await this.problems.copyForWorksheet(user, problem);
    order.splice(insertAt, 0, itemId);
    await this.repo.replaceItems(ws.id, order);
    return this.detail(updated, user);
  }

  /** reorderWorksheetItem. afterId is required: null = first, an item id = right after it. */
  async reorderItem(
    user: CurrentUserData,
    id: number,
    itemId: number,
    body: ReorderItemRequest,
  ): Promise<WorksheetDetail> {
    const ws = await this.findOwn(user, id);
    const order = await this.liveItemIds(ws.id);
    if (!order.includes(itemId)) throw ApiError.notFound();
    if (body.afterId !== null && decodeId(body.afterId) === itemId) {
      throw ApiError.badRequest('afterId must not be the item itself.');
    }
    const rest = order.filter((i) => i !== itemId);
    const insertAt = this.indexAfter(rest, body.afterId);
    if (body.lockVersion !== ws.lockVersion) throw this.lockMismatch();

    const updated = await this.claimLock(ws, body.lockVersion, this.lockMismatch());
    rest.splice(insertAt, 0, itemId);
    await this.repo.replaceItems(ws.id, rest);
    return this.detail(updated, user);
  }

  /**
   * removeWorksheetItem. Only unlinks: the problem stays in the caller's collection.
   * The lock comes in If-Match because DELETE has no body, so a mismatch is 412, not 409.
   */
  async removeItem(
    user: CurrentUserData,
    id: number,
    itemId: number,
    ifMatch: string | undefined,
  ): Promise<WorksheetDetail> {
    const ws = await this.findOwn(user, id);
    const lockVersion = parseIfMatch(ifMatch); // 400 when missing or malformed
    const order = await this.liveItemIds(ws.id);
    if (!order.includes(itemId)) throw ApiError.notFound();
    if (lockVersion !== ws.lockVersion) throw this.lockPreconditionFailed();

    const updated = await this.claimLock(ws, lockVersion, this.lockPreconditionFailed());
    await this.repo.replaceItems(
      ws.id,
      order.filter((i) => i !== itemId),
    );
    return this.detail(updated, user);
  }

  // ---------- helpers ----------

  private lockMismatch(): ApiError {
    return ApiError.conflict(ErrorCode.LOCK_MISMATCH, 'Someone saved this worksheet in between. Reload and try again.');
  }

  /** The same mismatch when the lock came in If-Match (412). */
  private lockPreconditionFailed(): ApiError {
    return ApiError.preconditionFailed(
      ErrorCode.LOCK_MISMATCH,
      'Someone saved this worksheet in between. Reload and try again.',
    );
  }

  /**
   * The atomic guard of every item change: raises lockVersion and version only when the lock still
   * matches, otherwise throws `onMismatch`. The checks before it are only fast fails.
   */
  private async claimLock(ws: WorksheetRow, lockVersion: number, onMismatch: ApiError): Promise<WorksheetRow> {
    const updated = await this.repo.updateIfLockVersion(ws.id, lockVersion, { version: ws.version + 1 });
    if (!updated) throw onMismatch;
    return updated;
  }

  /**
   * The worksheet's item problem ids in order, live problems only ("deleted problems are left out").
   * Saving writes back only these, so links to deleted problems disappear on the next item change.
   */
  private async liveItemIds(worksheetId: number): Promise<number[]> {
    const ids = (await this.repo.findItems([worksheetId])).map((i) => i.problemId);
    const live = await this.problems.liveIds(ids);
    return ids.filter((pid) => live.has(pid));
  }

  /** Index to insert at: null = 0 (first), an item id = right after it; an id not in `order` is 400. */
  private indexAfter(order: number[], afterId: string | null): number {
    if (afterId === null) return 0;
    const index = order.indexOf(decodeId(afterId) ?? -1);
    if (index < 0) throw ApiError.badRequest('afterId is not an item of this worksheet.');
    return index + 1;
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

  /** The whole worksheet with its live items in order (what every item endpoint returns). */
  private async detail(row: WorksheetRow, user: CurrentUserData): Promise<WorksheetDetail> {
    const ids = (await this.repo.findItems([row.id])).map((i) => i.problemId);
    const details = await this.problems.detailsByIds(user, ids);
    const items = ids.flatMap((pid) => details.get(pid) ?? []); // deleted problems are left out
    return toDetail(row, items, await this.lookups([row]), user.id);
  }

  /** Batch-loads everything the mapper needs: one lookup per related table. */
  private async lookups(rows: WorksheetRow[]): Promise<WorksheetLookups> {
    const links = await this.repo.findItems(rows.map((r) => r.id));
    const live = await this.problems.liveIds(links.map((l) => l.problemId));
    const itemCounts = new Map<number, number>();
    for (const l of links) {
      if (live.has(l.problemId)) itemCounts.set(l.worksheetId, (itemCounts.get(l.worksheetId) ?? 0) + 1);
    }
    return {
      users: await this.users.refsByIds(rows.map((r) => r.authorId)),
      tags: await this.tags.refsByIds(rows.flatMap((r) => r.tagIds)),
      chapters: await this.chapters.refsByIds(rows.flatMap((r) => r.chapterIds)),
      itemCounts,
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
