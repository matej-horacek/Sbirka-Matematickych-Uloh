import { Injectable } from '@nestjs/common';
import type {
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
import { ProblemsRepository } from '../repositories/problems.repository';
import { ProblemCopiesService } from './problem-copies.service';
import { ProblemRelationsService } from './problem-relations.service';
import { ProblemSetsService } from './problem-sets.service';

/**
 * Facade of the problems module: the only service other modules may use.
 * Controllers call exactly one method here per request.
 */
@Injectable()
export class ProblemsService {
  constructor(
    private readonly repo: ProblemsRepository,
    private readonly sets: ProblemSetsService,
    private readonly copies: ProblemCopiesService,
    private readonly relations: ProblemRelationsService,
    private readonly users: UsersService,
    private readonly tags: TagsService,
    private readonly chapters: ChaptersService,
    private readonly licenses: LicensesService,
  ) {}

  // ---------- endpoints ----------

  list(user: CurrentUserData, q: ListProblemsQuery): ProblemPage {
    const tagIds = q.tagId?.map(decodeId).filter((id): id is number => id !== null);
    const chapterIds = q.chapterId?.map(decodeId).filter((id): id is number => id !== null);
    const { rows, total } = this.repo.findMany(
      {
        ...(q.scope === 'mine' ? { authorId: user.id } : { publishStatus: 'PUBLISHED' }),
        tagIds,
        chapterIds: chapterIds && this.chapters.withDescendants(chapterIds),
        languageCode: q.language,
      },
      q.page,
      q.limit,
    );
    const lk = this.lookups(rows);
    return { items: rows.map((r) => toListItem(r, lk)), meta: { page: q.page, limit: q.limit, total } };
  }

  get(user: CurrentUserData, id: number): ProblemDetail {
    return this.detail(this.findVisible(user, id), user);
  }

  create(user: CurrentUserData, body: ProblemCreate): ProblemDetail {
    const tagIds = this.relations.tagIds(user.id, body.tagIds) ?? [];
    const chapterIds = this.relations.chapterIds(user.id, body.chapterIds) ?? [];

    const row = this.repo.insert({
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
  update(user: CurrentUserData, id: number, body: ProblemPatch): { accepted: boolean; problem: ProblemDetail } {
    const row = this.findOwn(user, id);
    if (row.parentId !== null) {
      throw ApiError.conflict(ErrorCode.SET_CHILD_EDIT_VIA_PARENT, 'Edit a set child through its parent.');
    }
    if (body.lockVersion !== row.lockVersion) {
      throw ApiError.conflict(ErrorCode.LOCK_MISMATCH, 'Someone saved this problem in between. Reload and try again.');
    }

    const childCount = this.repo.findChildren(row.id).length;
    const result = body.result !== undefined ? body.result : row.result;
    if (!parentMayHaveResult(result, childCount)) {
      throw ApiError.conflict(ErrorCode.SET_PARENT_HAS_RESULT, 'A set parent must not have a result.');
    }
    const tagIds = this.relations.tagIds(user.id, body.tagIds);
    const chapterIds = this.relations.chapterIds(user.id, body.chapterIds);

    if (row.publishStatus === 'PUBLISHED' && user.trust !== 'TRUSTED' && user.role !== 'ADMIN') {
      // TODO Phase B: store the change as a problem_revision waiting for review.
      return { accepted: true, problem: this.detail(row, user) };
    }

    // TODO Phase B: a trusted user's minor edit bumps minor_version instead of version.
    const updated = this.repo.update(row.id, {
      ...contentFields(body),
      ...(tagIds && { tagIds }),
      ...(chapterIds && { chapterIds }),
      version: row.version + 1,
      lockVersion: row.lockVersion + 1,
    });
    return { accepted: false, problem: this.detail(updated, user) };
  }

  remove(user: CurrentUserData, id: number): void {
    const row = this.findOwn(user, id);
    if (row.parentId !== null) {
      throw ApiError.conflict(ErrorCode.SET_CHILD_EDIT_VIA_PARENT, 'Delete a set child through its parent.');
    }
    this.repo.softDelete([row.id, ...this.repo.findChildren(row.id).map((c) => c.id)]);
  }

  copy(user: CurrentUserData, id: number): ProblemDetail {
    const original = this.findVisible(user, id);
    return this.detail(this.copies.copy(user.id, original), user);
  }

  dissolve(user: CurrentUserData, id: number): ProblemList {
    const row = this.findOwn(user, id);
    if (row.parentId !== null) {
      throw ApiError.conflict(ErrorCode.SET_CHILD_EDIT_VIA_PARENT, 'A set child cannot be dissolved.');
    }
    const children = this.repo.findChildren(row.id);
    if (!children.length) throw ApiError.conflict(ErrorCode.NOT_A_SET, 'This problem is not a set.');
    const freed = this.sets.dissolve(row, children);
    const lk = this.lookups(freed);
    return { items: freed.map((r) => toListItem(r, lk)) };
  }

  // ---------- facade for other modules (publication) ----------

  /** The caller's own problem with its children; 404/403 like the endpoints. */
  findOwnWithChildren(user: CurrentUserData, id: number): { problem: ProblemRow; children: ProblemRow[] } {
    const problem = this.findOwn(user, id);
    return { problem, children: this.repo.findChildren(problem.id) };
  }

  /** Sets the status on the given problems and the licence on those that have none. */
  applyPublication(ids: number[], status: PublishStatus, licenseIdForUnlicensed: number | null): void {
    for (const id of ids) {
      const row = this.repo.findById(id)!;
      const source = row.source.licenseId === null && licenseIdForUnlicensed !== null
        ? { ...row.source, licenseId: licenseIdForUnlicensed }
        : row.source;
      this.repo.update(id, { publishStatus: status, source });
    }
  }

  detailFor(user: CurrentUserData, id: number): ProblemDetail {
    return this.get(user, id);
  }

  // ---------- helpers ----------

  /** 404 when the problem doesn't exist or the caller can't see it. */
  private findVisible(user: CurrentUserData, id: number): ProblemRow {
    const row = this.repo.findById(id);
    if (!row || !canView(row, user.id)) throw ApiError.notFound();
    return row;
  }

  /** Author only: others get 403 on a published problem and 404 on a private one. */
  private findOwn(user: CurrentUserData, id: number): ProblemRow {
    const row = this.findVisible(user, id);
    if (row.authorId !== user.id) throw ApiError.forbidden();
    return row;
  }

  private detail(row: ProblemRow, user: CurrentUserData): ProblemDetail {
    const children = this.repo.findChildren(row.id);
    return toDetail(row, children, this.lookups([row, ...children]), user.id);
  }

  /** Batch-loads everything the mapper needs: one lookup per related table. */
  private lookups(rows: ProblemRow[]): ProblemLookups {
    return {
      users: this.users.refsByIds(rows.map((r) => r.authorId)),
      tags: this.tags.refsByIds(rows.flatMap((r) => r.tagIds)),
      chapters: this.chapters.refsByIds(rows.flatMap((r) => r.chapterIds)),
      licenses: this.licenses.refsByIds(rows.flatMap((r) => (r.source.licenseId === null ? [] : [r.source.licenseId]))),
      childCounts: this.repo.countChildren(rows.map((r) => r.id)),
    };
  }
}
