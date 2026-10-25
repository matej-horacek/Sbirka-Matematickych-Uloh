import type { ContentSourceRow } from '../../../database/mock-database';

/**
 * Source of a copy, per the spec:
 * OWN → LICENSED_USE citing the original author; LICENSED_USE and FREE_USE keep
 * their type and citation; the licence is always inherited.
 * TODO decide: copying your own problem currently also becomes LICENSED_USE
 * citing yourself (the spec does not make an exception).
 */
export function sourceForCopy(original: ContentSourceRow, originalAuthorName: string): ContentSourceRow {
  if (original.originType === 'OWN') {
    return { ...original, originType: 'LICENSED_USE', sourceCitationText: `Převzato od: ${originalAuthorName}` };
  }
  return { ...original };
}
