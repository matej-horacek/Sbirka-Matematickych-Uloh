import type { ProblemRow } from '../../../database/mock-database';

/** The author sees everything of theirs; others see only published problems. */
export function canView(problem: ProblemRow, userId: number): boolean {
  return problem.authorId === userId || problem.publishStatus === 'PUBLISHED';
}
