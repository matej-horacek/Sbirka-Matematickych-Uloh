import { Injectable } from '@nestjs/common';
import { ErrorCode, type ProblemDetail, type PublishRequest } from '@matematika/contracts';
import type { CurrentUserData } from '../../../common/decorators/current-user.decorator';
import { ApiError } from '../../../common/errors/api-error';
import { decodeId } from '../../../common/utils/ids';
import { LicensesService } from '../../licenses/services/licenses.service';
import { ProblemsService } from '../../problems/services/problems.service';
import { statusAfterPublish } from '../domain/publish-rules';

/** Publishing rules. Changes to problems go through the problems facade only. */
@Injectable()
export class PublicationService {
  constructor(
    private readonly problems: ProblemsService,
    private readonly licenses: LicensesService,
  ) {}

  publish(user: CurrentUserData, id: number, body: PublishRequest): ProblemDetail {
    const { problem, children } = this.problems.findOwnWithChildren(user, id);

    if (problem.parentId !== null) {
      throw ApiError.conflict(ErrorCode.SET_CHILD_NOT_PUBLISHABLE, 'A set child is published together with its set.');
    }
    if (problem.publishStatus === 'BLOCKED') throw ApiError.forbidden('This problem is blocked by moderation.');
    if (problem.publishStatus === 'PUBLISHED' || problem.publishStatus === 'REVIEWING') {
      return this.problems.detailFor(user, id); // idempotent: already done
    }
    const status = statusAfterPublish(user.trust, user.role);
    if (!status) throw ApiError.forbidden('Your account must be verified before publishing.', ErrorCode.TRUST_TOO_LOW);

    // The licence: every problem in the set needs one that allows publication.
    const all = [problem, ...children];
    const licensed = this.licenses.rowsByIds(all.flatMap((p) => (p.source.licenseId === null ? [] : [p.source.licenseId])));
    for (const p of all) {
      if (p.source.licenseId !== null && !licensed.get(p.source.licenseId)?.allowsPublication) {
        throw ApiError.conflict(ErrorCode.LICENSE_REQUIRED, `"${p.name}" has a licence that does not allow publication.`);
      }
    }

    let newLicenseId: number | null = null;
    if (all.some((p) => p.source.licenseId === null)) {
      const id = body.licenseId ? decodeId(body.licenseId) : null;
      const license = id === null ? undefined : this.licenses.findById(id);
      if (!license) throw ApiError.conflict(ErrorCode.LICENSE_REQUIRED, 'Choose a licence (licenseId) to publish.');
      if (!license.allowsPublication) {
        throw ApiError.conflict(ErrorCode.LICENSE_REQUIRED, 'This licence does not allow publication.');
      }
      newLicenseId = license.id;
    }

    this.problems.applyPublication(all.map((p) => p.id), status, newLicenseId);
    return this.problems.detailFor(user, id);
  }
}
