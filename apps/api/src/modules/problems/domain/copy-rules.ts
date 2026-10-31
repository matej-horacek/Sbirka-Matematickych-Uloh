import type { ContentSourceRow } from '../../../database/mock-database';

/**
 * Source of a copy, per the spec:
 * OWN → LICENSED_USE citing the original author; LICENSED_USE and FREE_USE keep
 * their type and citation; the licence is always inherited.
 * Exception (O-4): copying your own problem keeps OWN, with no citation.
 */
export function sourceForCopy(original: ContentSourceRow, originalAuthorName: string, callerOwns: boolean): ContentSourceRow {
  if (original.originType === 'OWN') {
    // DOMAIN-REVIEW (O-4): a copy of your own OWN problem stays OWN with no citation; the licence is still inherited.
    if (callerOwns) return { ...original, sourceCitationText: null };
    return { ...original, originType: 'LICENSED_USE', sourceCitationText: `Převzato od: ${originalAuthorName}` };
  }
  return { ...original };
}
