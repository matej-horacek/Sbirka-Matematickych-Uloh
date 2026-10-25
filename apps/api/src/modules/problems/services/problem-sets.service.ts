import { Injectable } from '@nestjs/common';
import type { ProblemChildInput } from '@matematika/contracts';
import type { ProblemRow } from '../../../database/mock-database';
import { ApiError } from '../../../common/errors/api-error';
import { decodeId } from '../../../common/utils/ids';
import { positionAt } from '../../../common/utils/position';
import { contentFields } from '../domain/content-fields';
import { canView } from '../domain/visibility';
import { ProblemsRepository } from '../repositories/problems.repository';
import { ProblemCopiesService } from './problem-copies.service';
import { ProblemRelationsService } from './problem-relations.service';

type PlannedChild =
  | { kind: 'update'; input: ProblemChildInput; child: ProblemRow; relations: Relations; position: string }
  | { kind: 'copy'; input: ProblemChildInput; original: ProblemRow; relations: Relations; position: string }
  | { kind: 'create'; input: ProblemChildInput; relations: Relations; position: string };

type Relations = { tagIds?: number[]; chapterIds?: number[] };

/** Whole-set editing: the `children` array on create and patch, and dissolve. */
@Injectable()
export class ProblemSetsService {
  constructor(
    private readonly repo: ProblemsRepository,
    private readonly copies: ProblemCopiesService,
    private readonly relations: ProblemRelationsService,
  ) {}

  /**
   * Checks every child without writing anything, so a 400 never leaves a half-saved set.
   * (Phase B: the whole save also runs in one database transaction.)
   */
  planChildren(userId: number, parentId: number | null, inputs: ProblemChildInput[]): PlannedChild[] {
    const existing = new Map(parentId === null ? [] : this.repo.findChildren(parentId).map((c) => [c.id, c]));

    return inputs.map((input, i) => {
      const field = `children.${i}`;
      const position = positionAt(i);
      const relations: Relations = {
        tagIds: this.relations.tagIds(userId, input.tagIds, `${field}.tagIds`),
        chapterIds: this.relations.chapterIds(userId, input.chapterIds, `${field}.chapterIds`),
      };

      if (input.id) {
        const id = decodeId(input.id);
        const child = id === null ? undefined : existing.get(id);
        if (!child) throw ApiError.badRequest(`${field}.id: not a child of this set`);
        return { kind: 'update', input, child, relations, position };
      }
      if (input.copyFromId) {
        const id = decodeId(input.copyFromId);
        const original = id === null ? undefined : this.repo.findById(id);
        if (!original || !canView(original, userId)) throw ApiError.badRequest(`${field}.copyFromId: problem not found`);
        if (this.repo.findChildren(original.id).length) {
          throw ApiError.badRequest(`${field}.copyFromId: a set cannot be put into a set`);
        }
        return { kind: 'copy', input, original, relations, position };
      }
      return { kind: 'create', input, relations, position };
    });
  }

  /**
   * Makes the set's children match the plan: update / copy in / create,
   * and existing children missing from the list are removed. Array order = position.
   */
  applyChildren(userId: number, parent: ProblemRow, plan: PlannedChild[]): void {
    const before = this.repo.findChildren(parent.id).map((c) => c.id);
    const kept = new Set<number>();

    for (const step of plan) {
      const relations = defined(step.relations);
      if (step.kind === 'update') {
        this.repo.update(step.child.id, { ...contentFields(step.input), ...relations, position: step.position });
        kept.add(step.child.id);
      } else if (step.kind === 'copy') {
        const copy = this.copies.copy(userId, step.original, { parentId: parent.id, position: step.position });
        // Copy first, then apply the fields sent with it.
        this.repo.update(copy.id, { ...contentFields(step.input), ...relations, publishStatus: parent.publishStatus });
      } else {
        const input = step.input;
        this.repo.insert({
          name: input.name!,
          assignment: input.assignment!,
          result: input.result ?? null,
          languageCode: input.language ?? parent.languageCode,
          difficulty: input.difficulty ?? null,
          authorId: userId,
          publishStatus: parent.publishStatus,
          version: 1,
          lockVersion: 1,
          parentId: parent.id,
          position: step.position,
          originalProblemId: null,
          originalProblemVersion: null,
          source: { ...parent.source, originType: 'OWN', sourceCitationText: null, licenseId: null, licenseNote: null },
          tagIds: relations.tagIds ?? [],
          chapterIds: relations.chapterIds ?? [],
        });
      }
    }

    const removed = before.filter((id) => !kept.has(id));
    if (removed.length) this.repo.softDelete(removed);
  }

  /** Children become standalone PRIVATE problems; the parent is soft-deleted. */
  dissolve(parent: ProblemRow, children: ProblemRow[]): ProblemRow[] {
    const freed = children.map((c) => this.repo.update(c.id, { parentId: null, position: null, publishStatus: 'PRIVATE' }));
    this.repo.softDelete([parent.id]);
    return freed;
  }
}

function defined(r: Relations): Relations {
  return { ...(r.tagIds && { tagIds: r.tagIds }), ...(r.chapterIds && { chapterIds: r.chapterIds }) };
}
