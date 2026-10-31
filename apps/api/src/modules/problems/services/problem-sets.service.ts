import { Injectable } from '@nestjs/common';
import { ErrorCode, type AddChildRequest, type ReorderChildRequest } from '@matematika/contracts';
import type { ProblemRow } from '../../../database/mock-database';
import type { CurrentUserData } from '../../../common/decorators/current-user.decorator';
import { ApiError } from '../../../common/errors/api-error';
import { decodeId } from '../../../common/utils/ids';
import { positionAt } from '../../../common/utils/position';
import { LicensesService } from '../../licenses/services/licenses.service';
import { canView } from '../domain/visibility';
import { ProblemsRepository } from '../repositories/problems.repository';
import { ProblemCopiesService } from './problem-copies.service';

/** Set operations: dissolve, and adding, reordering and removing single children. */
@Injectable()
export class ProblemSetsService {
  constructor(
    private readonly repo: ProblemsRepository,
    private readonly copies: ProblemCopiesService,
    private readonly licenses: LicensesService,
  ) {}

  /** Children become standalone PRIVATE problems; the parent is soft-deleted. */
  dissolve(parent: ProblemRow, children: ProblemRow[]): ProblemRow[] {
    const freed = children.map((c) => this.repo.update(c.id, { parentId: null, position: null, publishStatus: 'PRIVATE' }));
    this.repo.softDelete([parent.id]);
    return freed;
  }

  /**
   * addSetChild: `set` is already the caller's own problem (404/403 done by the caller).
   * Every check runs before the first write, so a refused request changes nothing.
   * Returns `accepted: true` when the change must wait for review (HTTP 202, nothing stored).
   */
  addChild(user: CurrentUserData, set: ProblemRow, body: AddChildRequest): { accepted: boolean } {
    if ((body.problemId === undefined) === (body.copyFromId === undefined)) {
      throw ApiError.badRequest('Send exactly one of problemId (move) or copyFromId (copy).');
    }
    if (set.parentId !== null) {
      throw ApiError.conflict(ErrorCode.IS_SET_CHILD, 'A set child cannot become a set.');
    }
    if (body.lockVersion !== set.lockVersion) {
      throw ApiError.conflict(ErrorCode.LOCK_MISMATCH, 'Someone saved this set in between. Reload and try again.');
    }
    if (set.result != null) {
      throw ApiError.conflict(ErrorCode.SET_PARENT_HAS_RESULT, 'A set parent must not have a result. Clear it first.');
    }

    const existing = this.repo.findChildren(set.id);
    const source = this.findSource(user, body);
    const isMove = body.problemId !== undefined;

    if (source.id === set.id) {
      throw ApiError.conflict(ErrorCode.CANNOT_ADD_TO_SET, 'A set cannot be added to itself.');
    }
    if (this.repo.findChildren(source.id).length > 0) {
      throw ApiError.conflict(ErrorCode.CANNOT_ADD_TO_SET, 'A set cannot be added to another set.');
    }
    if (isMove) {
      // DOMAIN-REVIEW (move): only your own PRIVATE standalone problem moves in (same record, no copy).
      if (source.authorId !== user.id) {
        throw ApiError.conflict(ErrorCode.CANNOT_ADD_TO_SET, 'You can only move your own problems into a set.');
      }
      if (source.parentId !== null) {
        throw ApiError.conflict(ErrorCode.CANNOT_ADD_TO_SET, 'This problem is already in a set.');
      }
      if (source.publishStatus !== 'PRIVATE') {
        throw ApiError.conflict(ErrorCode.CANNOT_ADD_TO_SET, 'Only a private problem can be moved into a set. Copy it instead.');
      }
    }

    // DOMAIN-REVIEW (afterId): missing = end, null = first, a child id = right after that child.
    let insertAt = existing.length;
    if (body.afterId === null) {
      insertAt = 0;
    } else if (body.afterId !== undefined) {
      const afterId = decodeId(body.afterId);
      const index = existing.findIndex((c) => c.id === afterId);
      if (index < 0) throw ApiError.badRequest('afterId is not a child of this set.');
      insertAt = index + 1;
    }

    // DOMAIN-REVIEW (inheritance on add): the child takes the set's status; in a PUBLISHED set a child
    // without a licence takes the set's licence, and a licence that forbids publication is refused.
    const published = set.publishStatus === 'PUBLISHED';
    let licenseId = source.source.licenseId;
    if (published) {
      licenseId = licenseId ?? set.source.licenseId;
      if (licenseId !== null && !this.licenses.findById(licenseId)?.allowsPublication) {
        throw ApiError.conflict(ErrorCode.LICENSE_REQUIRED, `"${source.name}" has a licence that does not allow publication.`);
      }
    }

    if (this.needsReview(user, set)) return { accepted: true };

    const child = isMove ? source : this.copies.copy(user.id, source);
    this.repo.update(child.id, {
      parentId: set.id,
      publishStatus: set.publishStatus,
      source: { ...child.source, licenseId: published ? licenseId : child.source.licenseId },
    });

    // The mock renumbers all positions (see common/utils/position.ts).
    const order = existing.map((c) => c.id);
    order.splice(insertAt, 0, child.id);
    order.forEach((id, i) => this.repo.update(id, { position: positionAt(i) }));

    this.repo.update(set.id, { lockVersion: set.lockVersion + 1 });
    return { accepted: false };
  }

  /**
   * reorderSetChild: `set` is the caller's own problem. Order of checks: child belongs to the set (404),
   * afterId (400), lock (409). Returns `accepted: true` for the 202 path (nothing stored).
   */
  reorderChild(user: CurrentUserData, set: ProblemRow, childId: number, body: ReorderChildRequest): { accepted: boolean } {
    const children = this.repo.findChildren(set.id);
    if (!children.some((c) => c.id === childId)) throw ApiError.notFound();

    // DOMAIN-REVIEW (reorder): afterId is required; null = first, a child id = right after that child.
    let rest = children.filter((c) => c.id !== childId).map((c) => c.id);
    let insertAt = 0;
    if (body.afterId !== null) {
      const afterId = decodeId(body.afterId);
      if (afterId === childId) throw ApiError.badRequest('afterId must not be the child itself.');
      const index = afterId === null ? -1 : rest.indexOf(afterId);
      if (index < 0) throw ApiError.badRequest('afterId is not a child of this set.');
      insertAt = index + 1;
    }
    if (body.lockVersion !== set.lockVersion) {
      throw ApiError.conflict(ErrorCode.LOCK_MISMATCH, 'Someone saved this set in between. Reload and try again.');
    }
    if (this.needsReview(user, set)) return { accepted: true };

    rest = [...rest.slice(0, insertAt), childId, ...rest.slice(insertAt)];
    rest.forEach((id, i) => this.repo.update(id, { position: positionAt(i) }));
    this.repo.update(set.id, { lockVersion: set.lockVersion + 1 });
    return { accepted: false };
  }

  /**
   * removeSetChild: the set's lockVersion comes from If-Match (412 on a mismatch).
   * The child is not deleted: it becomes a standalone PRIVATE problem.
   */
  removeChild(user: CurrentUserData, set: ProblemRow, childId: number, lockVersion: number): { accepted: boolean } {
    const child = this.repo.findChildren(set.id).find((c) => c.id === childId);
    if (!child) throw ApiError.notFound();
    if (lockVersion !== set.lockVersion) {
      throw ApiError.preconditionFailed(ErrorCode.LOCK_MISMATCH, 'Someone saved this set in between. Reload and try again.');
    }
    if (this.needsReview(user, set)) return { accepted: true };

    // DOMAIN-REVIEW (last child out): the child becomes a standalone PRIVATE problem; when it was the
    // last one, the set is a plain problem again (a set is just a problem with children).
    this.repo.update(child.id, { parentId: null, position: null, publishStatus: 'PRIVATE' });
    this.repo.update(set.id, { lockVersion: set.lockVersion + 1 });
    return { accepted: false };
  }

  /** TODO Phase B: store the change as a revision waiting for review. The mock stores nothing. */
  private needsReview(user: CurrentUserData, set: ProblemRow): boolean {
    return set.publishStatus === 'PUBLISHED' && user.trust !== 'TRUSTED' && user.role !== 'ADMIN';
  }

  /** The problem named by problemId / copyFromId; 400 when it doesn't exist or the caller can't see it. */
  private findSource(user: CurrentUserData, body: AddChildRequest): ProblemRow {
    const raw = body.problemId ?? body.copyFromId!;
    const id = decodeId(raw);
    const row = id === null ? undefined : this.repo.findById(id);
    if (!row || !canView(row, user.id)) throw ApiError.badRequest('The problem was not found.');
    return row;
  }
}
