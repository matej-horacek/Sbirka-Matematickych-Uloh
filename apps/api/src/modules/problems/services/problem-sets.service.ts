import { Injectable } from '@nestjs/common';
import { ErrorCode, type AddChildRequest } from '@matematika/contracts';
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

    // TODO Phase B: store the change as a revision waiting for review. The mock stores nothing.
    if (published && user.trust !== 'TRUSTED' && user.role !== 'ADMIN') return { accepted: true };

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

  /** The problem named by problemId / copyFromId; 400 when it doesn't exist or the caller can't see it. */
  private findSource(user: CurrentUserData, body: AddChildRequest): ProblemRow {
    const raw = body.problemId ?? body.copyFromId!;
    const id = decodeId(raw);
    const row = id === null ? undefined : this.repo.findById(id);
    if (!row || !canView(row, user.id)) throw ApiError.badRequest('The problem was not found.');
    return row;
  }
}
