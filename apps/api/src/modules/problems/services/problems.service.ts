import { Inject, Injectable } from '@nestjs/common';
import type {
  AddChildRequest,
  ReorderChildRequest,
  ProblemCreate,
  ProblemDetail,
  ProblemList,
  ProblemPage,
  ProblemPatch,
} from '@matematika/contracts';
import { ErrorCode } from '@matematika/contracts';
import type { ProblemRow, PublishStatus } from '../../../database/mock-database';
import type { CurrentUserData } from '../../../common/decorators/current-user.decorator';
import { ApiError } from '../../../common/errors/api-error';
import { decodeId } from '../../../common/utils/ids';
import { ChaptersService } from '../../chapters/services/chapters.service';
import { LicensesService } from '../../licenses/services/licenses.service';
import { TagsService } from '../../tags/services/tags.service';
import { UsersService } from '../../users/services/users.service';
import { contentFields } from '../domain/content-fields';
import { parentMayHaveResult } from '../domain/set-rules';
import { canView } from '../domain/visibility';
import type { ListProblemsQuery } from '../dto/list-problems.query';
import { toDetail, toListItem, type ProblemLookups } from '../mappers/problem.mapper';
import { PROBLEMS_REPOSITORY, type ProblemsRepository } from '../repositories/problems.repository';
import { ProblemCopiesService } from './problem-copies.service';
import { ProblemRelationsService } from './problem-relations.service';
import { ProblemSetsService } from './problem-sets.service';

/** If-Match carries the set's lockVersion as an ETag: "4". Missing or malformed → 400. */
function parseIfMatch(header: string | undefined): number {
  const match = /^"(\d+)"$/.exec(header ?? '');
  if (!match) throw ApiError.badRequest('If-Match must carry the set lockVersion in quotes, e.g. "4".');
  return Number(match[1]);
}

/**
 * Facade of the problems module: the only service other modules may use.
 * Controllers call exactly one method here per request.
 */
@Injectable()
export class ProblemsService {
  constructor(
    @Inject(PROBLEMS_REPOSITORY) private readonly repo: ProblemsRepository,
    private readonly sets: ProblemSetsService,
    private readonly copies: ProblemCopiesService,
    private readonly relations: ProblemRelationsService,
    private readonly users: UsersService,
    private readonly tags: TagsService,
    private readonly chapters: ChaptersService,
    private readonly licenses: LicensesService,
  ) {}

  // ---------- endpoints ----------

  async list(user: CurrentUserData, q: ListProblemsQuery): Promise<ProblemPage> {
    const tagIds = q.tagId?.map(decodeId).filter((id): id is number => id !== null);
    const chapterIds = q.chapterId?.map(decodeId).filter((id): id is number => id !== null);
    const { rows, total } = await this.repo.findMany(
      {
        ...(q.scope === 'mine' ? { authorId: user.id } : { publishStatus: 'PUBLISHED' }),
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

  async get(user: CurrentUserData, id: number): Promise<ProblemDetail> {
    return this.detail(await this.findVisible(user, id), user);
  }

  async create(user: CurrentUserData, body: ProblemCreate): Promise<ProblemDetail> {
    const tagIds = (await this.relations.tagIds(user.id, body.tagIds)) ?? [];
    const chapterIds = (await this.relations.chapterIds(user.id, body.chapterIds)) ?? [];

    const row = await this.repo.insert({
      name: body.name!,
      assignment: body.assignment!,
      result: body.result ?? null,
      languageCode: body.language ?? null,
      difficulty: body.difficulty ?? null,
      authorId: user.id,
      publishStatus: 'PRIVATE',
      version: 1,
      lockVersion: 1,
      parentId: null,
      position: null,
      originalProblemId: null,
      originalProblemVersion: null,
      // New problems start as OWN with no licence; the licence is chosen when publishing.
      source: {
        originType: 'OWN',
        sourceCitationText: null,
        licenseId: null,
        licenseNote: null,
        citationAudience: 'PUBLIC',
        showInWeb: true,
        showInPdf: true,
      },
      tagIds,
      chapterIds,
    });
    return this.detail(row, user);
  }

  /** Returns `accepted: true` when the change must wait for review (HTTP 202). */
  async update(user: CurrentUserData, id: number, body: ProblemPatch): Promise<{ accepted: boolean; problem: ProblemDetail }> {
    const row = await this.findOwn(user, id);
    if (row.parentId !== null) {
      throw ApiError.conflict(ErrorCode.IS_SET_CHILD, 'Edit a set child through its parent.');
    }
    if (body.lockVersion !== row.lockVersion) {
      throw ApiError.conflict(ErrorCode.LOCK_MISMATCH, 'Someone saved this problem in between. Reload and try again.');
    }

    const childCount = (await this.repo.findChildren(row.id)).length;
    const result = body.result !== undefined ? body.result : row.result;
    if (!parentMayHaveResult(result, childCount)) {
      throw ApiError.conflict(ErrorCode.SET_PARENT_HAS_RESULT, 'A set parent must not have a result.');
    }
    const tagIds = await this.relations.tagIds(user.id, body.tagIds);
    const chapterIds = await this.relations.chapterIds(user.id, body.chapterIds);

    if (row.publishStatus === 'PUBLISHED' && user.trust !== 'TRUSTED' && user.role !== 'ADMIN') {
      // TODO: store the change as a problem_revision waiting for review.
      return { accepted: true, problem: await this.detail(row, user) };
    }

    // TODO: a trusted user's minor edit bumps minor_version instead of version.
    const updated = await this.repo.update(row.id, {
      ...contentFields(body),
      ...(tagIds && { tagIds }),
      ...(chapterIds && { chapterIds }),
      version: row.version + 1,
      lockVersion: row.lockVersion + 1,
    });
    return { accepted: false, problem: await this.detail(updated, user) };
  }

  async remove(user: CurrentUserData, id: number): Promise<void> {
    const row = await this.findOwn(user, id);
    if (row.parentId !== null) {
      throw ApiError.conflict(ErrorCode.IS_SET_CHILD, 'Delete a set child through its parent.');
    }
    await this.repo.softDelete([row.id, ...(await this.repo.findChildren(row.id)).map((c) => c.id)]);
  }

  async copy(user: CurrentUserData, id: number): Promise<ProblemDetail> {
    const original = await this.findVisible(user, id);
    return this.detail(await this.copies.copy(user.id, original), user);
  }

  async dissolve(user: CurrentUserData, id: number): Promise<ProblemList> {
    const row = await this.findOwn(user, id);
    if (row.parentId !== null) {
      throw ApiError.conflict(ErrorCode.IS_SET_CHILD, 'A set child cannot be dissolved.');
    }
    const children = await this.repo.findChildren(row.id);
    if (!children.length) throw ApiError.conflict(ErrorCode.NOT_A_SET, 'This problem is not a set.');
    const freed = await this.sets.dissolve(row, children);
    const lk = await this.lookups(freed);
    return { items: freed.map((r) => toListItem(r, lk)) };
  }

  /** addSetChild – the set's author. Returns the whole set; `accepted` means 202 (waiting for review). */
  async addSetChild(user: CurrentUserData, id: number, body: AddChildRequest): Promise<{ accepted: boolean; problem: ProblemDetail }> {
    const set = await this.findOwn(user, id);
    const { accepted } = await this.sets.addChild(user, set, body);
    return { accepted, problem: await this.detail((await this.repo.findById(id))!, user) };
  }

  /** reorderSetChild – the set's author. */
  async reorderSetChild(user: CurrentUserData, id: number, childId: number, body: ReorderChildRequest): Promise<{ accepted: boolean; problem: ProblemDetail }> {
    const set = await this.findOwn(user, id);
    const { accepted } = await this.sets.reorderChild(user, set, childId, body);
    return { accepted, problem: await this.detail((await this.repo.findById(id))!, user) };
  }

  /** removeSetChild – the set's author; the lock comes from the If-Match header. */
  async removeSetChild(user: CurrentUserData, id: number, childId: number, ifMatch: string | undefined): Promise<{ accepted: boolean; problem: ProblemDetail }> {
    const set = await this.findOwn(user, id);
    const { accepted } = await this.sets.removeChild(user, set, childId, parseIfMatch(ifMatch));
    return { accepted, problem: await this.detail((await this.repo.findById(id))!, user) };
  }

  // ---------- facade for other modules (publication) ----------

  /** The caller's own problem with its children; 404/403 like the endpoints. */
  async findOwnWithChildren(user: CurrentUserData, id: number): Promise<{ problem: ProblemRow; children: ProblemRow[] }> {
    const problem = await this.findOwn(user, id);
    return { problem, children: await this.repo.findChildren(problem.id) };
  }

  /** Sets the status on the given problems and the licence on those that have none. */
  async applyPublication(ids: number[], status: PublishStatus, licenseIdForUnlicensed: number | null): Promise<void> {
    for (const id of ids) {
      const row = (await this.repo.findById(id))!;
      const source = row.source.licenseId === null && licenseIdForUnlicensed !== null
        ? { ...row.source, licenseId: licenseIdForUnlicensed }
        : row.source;
      await this.repo.update(id, { publishStatus: status, source });
    }
  }

  async detailFor(user: CurrentUserData, id: number): Promise<ProblemDetail> {
    return this.get(user, id);
  }

  // ---------- helpers ----------

  /** 404 when the problem doesn't exist or the caller can't see it. */
  private async findVisible(user: CurrentUserData, id: number): Promise<ProblemRow> {
    const row = await this.repo.findById(id);
    if (!row || !canView(row, user.id)) throw ApiError.notFound();
    return row;
  }

  /** Author only: others get 403 on a published problem and 404 on a private one. */
  private async findOwn(user: CurrentUserData, id: number): Promise<ProblemRow> {
    const row = await this.findVisible(user, id);
    if (row.authorId !== user.id) throw ApiError.forbidden();
    return row;
  }

  private async detail(row: ProblemRow, user: CurrentUserData): Promise<ProblemDetail> {
    const children = await this.repo.findChildren(row.id);
    return toDetail(row, children, await this.lookups([row, ...children]), user.id);
  }

  /** Batch-loads everything the mapper needs: one lookup per related table. */
  private async lookups(rows: ProblemRow[]): Promise<ProblemLookups> {
    return {
      users: await this.users.refsByIds(rows.map((r) => r.authorId)),
      tags: await this.tags.refsByIds(rows.flatMap((r) => r.tagIds)),
      chapters: await this.chapters.refsByIds(rows.flatMap((r) => r.chapterIds)),
      licenses: await this.licenses.refsByIds(rows.flatMap((r) => (r.source.licenseId === null ? [] : [r.source.licenseId]))),
      childCounts: await this.repo.countChildren(rows.map((r) => r.id)),
    };
  }
}
