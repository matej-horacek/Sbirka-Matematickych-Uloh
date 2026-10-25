import type { ProblemChildInput } from '@matematika/contracts';

// Pure rules for sets: no Nest, no database. Easy to unit-test.

/** Returns an error message for the first invalid child, or null when all are valid. */
export function checkChildInputs(inputs: ProblemChildInput[], mode: 'create' | 'patch'): string | null {
  for (const [i, child] of inputs.entries()) {
    if (child.id && child.copyFromId) return `children.${i}: id and copyFromId cannot both be set`;
    if (mode === 'create' && child.id) return `children.${i}.id: not allowed when creating a problem`;
    if (!child.id && !child.copyFromId && (!child.name || !child.assignment)) {
      return `children.${i}: a new child needs name and assignment`;
    }
  }
  return null;
}

/** A set parent (at least one child) must not have a result. */
export function parentMayHaveResult(result: string | null | undefined, childCount: number): boolean {
  return childCount === 0 || result == null;
}
