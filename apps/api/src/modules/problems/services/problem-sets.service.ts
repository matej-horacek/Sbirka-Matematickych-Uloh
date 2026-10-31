import { Injectable } from '@nestjs/common';
import type { ProblemRow } from '../../../database/mock-database';
import { ProblemsRepository } from '../repositories/problems.repository';

/** Set operations: dissolve, and (below) adding, reordering and removing single children. */
@Injectable()
export class ProblemSetsService {
  constructor(private readonly repo: ProblemsRepository) {}

  /** Children become standalone PRIVATE problems; the parent is soft-deleted. */
  dissolve(parent: ProblemRow, children: ProblemRow[]): ProblemRow[] {
    const freed = children.map((c) => this.repo.update(c.id, { parentId: null, position: null, publishStatus: 'PRIVATE' }));
    this.repo.softDelete([parent.id]);
    return freed;
  }
}
