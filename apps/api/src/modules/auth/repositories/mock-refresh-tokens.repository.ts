import { Injectable } from '@nestjs/common';
import { MockDatabase, type RefreshTokenRow } from '../../../database/mock-database.js';
import type { NewRefreshToken, RefreshTokensRepository } from './refresh-tokens.repository.js';

@Injectable()
export class MockRefreshTokensRepository implements RefreshTokensRepository {
  constructor(private readonly db: MockDatabase) {}

  async create(token: NewRefreshToken): Promise<RefreshTokenRow> {
    const row: RefreshTokenRow = { ...token, id: this.db.newRefreshTokenId(), revokedAt: null };
    this.db.refreshTokens.push(row);
    return row;
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRow | undefined> {
    return this.db.refreshTokens.find((t) => t.tokenHash === tokenHash);
  }

  async revokeIfActive(id: number): Promise<boolean> {
    const row = this.db.refreshTokens.find((t) => t.id === id);
    if (!row || row.revokedAt) return false;
    row.revokedAt = new Date();
    return true;
  }

  async revokeFamily(familyId: string): Promise<void> {
    const now = new Date();
    for (const t of this.db.refreshTokens) if (t.familyId === familyId && !t.revokedAt) t.revokedAt = now;
  }
}
