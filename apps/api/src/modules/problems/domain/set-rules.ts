// Pure rules for sets: no Nest, no database. Easy to unit-test.

/** A set parent (at least one child) must not have a result. */
export function parentMayHaveResult(result: string | null | undefined, childCount: number): boolean {
  return childCount === 0 || result == null;
}
