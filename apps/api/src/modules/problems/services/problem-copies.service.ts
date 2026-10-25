import { Injectable } from '@nestjs/common';
import type { ProblemRow } from '../../../database/mock-database';
import { UsersService } from '../../users/services/users.service';
import { sourceForCopy } from '../domain/copy-rules';
import { ProblemsRepository } from '../repositories/problems.repository';
import { ProblemRelationsService } from './problem-relations.service';

export interface CopyTarget {
  /** Copy as a child of this set; omit for a standalone copy. */
  parentId?: number;
  position?: string;
}

/**
 * One reusable copy method: the copy endpoint, `copyFromId` in sets, and later
 * adding foreign problems to worksheets all go through it.
 */
@Injectable()
export class ProblemCopiesService {
  constructor(
    private readonly repo: ProblemsRepository,
    private readonly relations: ProblemRelationsService,
    private readonly users: UsersService,
  ) {}

  copy(callerId: number, original: ProblemRow, target: CopyTarget = {}): ProblemRow {
    const callerOwns = original.authorId === callerId;
    const authorName = this.users.refsByIds([original.authorId]).get(original.authorId)?.displayName ?? '?';
    const { tagIds, chapterIds } = this.relations.forCopy(original.tagIds, original.chapterIds, callerOwns);

    const copy = this.repo.insert({
      name: original.name,
      assignment: original.assignment,
      result: original.result,
      languageCode: original.languageCode,
      difficulty: original.difficulty,
      authorId: callerId,
      publishStatus: 'PRIVATE',
      version: 1,
      lockVersion: 1,
      parentId: target.parentId ?? null,
      position: target.position ?? null,
      originalProblemId: original.id,
      originalProblemVersion: original.version,
      source: sourceForCopy(original.source, authorName),
      tagIds,
      chapterIds,
      // TODO Phase C (attachments): attachment rows point to the same stored images.
    });

    // Copying a set copies all its children. Copying a child gives a standalone problem.
    if (target.parentId === undefined) {
      for (const child of this.repo.findChildren(original.id)) {
        this.copy(callerId, child, { parentId: copy.id, position: child.position ?? undefined });
      }
    }
    return copy;
  }
}
