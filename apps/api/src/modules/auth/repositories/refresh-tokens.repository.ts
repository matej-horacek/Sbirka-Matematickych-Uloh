import type { RefreshTokenRow } from '../../../database/mock-database.js';

export const REFRESH_TOKENS_REPOSITORY = Symbol('REFRESH_TOKENS_REPOSITORY');

export type NewRefreshToken = Omit<RefreshTokenRow, 'id' | 'revokedAt'>;

/** Data access for refresh tokens (stored only as hashes). Queries only, no decisions. */
export interface RefreshTokensRepository {
  create(token: NewRefreshToken): Promise<RefreshTokenRow>;
  findByHash(tokenHash: string): Promise<RefreshTokenRow | undefined>;
  /** Atomically revokes one token if it is still active. false = it was already revoked (lost a race). */
  revokeIfActive(id: number): Promise<boolean>;
  /** Revokes every still-active token of the family. */
  revokeFamily(familyId: string): Promise<void>;
}
