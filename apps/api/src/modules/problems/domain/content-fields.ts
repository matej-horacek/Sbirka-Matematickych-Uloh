import type { ProblemBase } from '@matematika/contracts';
import type { ProblemRow } from '../../../database/mock-database';

type ContentFields = Partial<Pick<ProblemRow, 'name' | 'assignment' | 'result' | 'languageCode' | 'difficulty'>>;

/**
 * PATCH semantics: a missing field stays unchanged, `null` clears it.
 * Returns only the fields that were sent, mapped to row columns.
 */
export function contentFields(input: ProblemBase): ContentFields {
  const out: ContentFields = {};
  if (input.name !== undefined) out.name = input.name;
  if (input.assignment !== undefined) out.assignment = input.assignment;
  if (input.result !== undefined) out.result = input.result;
  if (input.language !== undefined) out.languageCode = input.language;
  if (input.difficulty !== undefined) out.difficulty = input.difficulty;
  return out;
}
