import type { PublishStatus, Role, TrustLevel } from '../../../database/mock-database';

/** Trusted teachers and admins publish directly; verified teachers go to review. */
export function statusAfterPublish(trust: TrustLevel, role: Role): PublishStatus | null {
  if (role === 'ADMIN' || trust === 'TRUSTED') return 'PUBLISHED';
  if (trust === 'VERIFIED') return 'REVIEWING';
  return null; // registered (unverified) teachers cannot publish
}
