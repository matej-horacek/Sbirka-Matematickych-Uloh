import { ApiError } from '../errors/api-error.js';

/** If-Match carries a lockVersion as an ETag: "4". Missing or malformed → 400. Used where DELETE has no body. */
export function parseIfMatch(header: string | undefined): number {
  const match = /^"(\d+)"$/.exec(header ?? '');
  if (!match) throw ApiError.badRequest('If-Match must carry the lockVersion in quotes, e.g. "4".');
  return Number(match[1]);
}
