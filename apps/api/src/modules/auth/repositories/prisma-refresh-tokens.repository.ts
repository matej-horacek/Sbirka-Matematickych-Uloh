import { Injectable } from '@nestjs/common';
import type { RefreshTokenRow } from '../../../database/mock-database.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { refresh_token } from '../../../generated/prisma/client.js';
import type { NewRefreshToken, RefreshTokensRepository } from './refresh-tokens.repository.js';

function toRow(t: refresh_token): RefreshTokenRow {
  return {
    id: t.id,
    userId: t.user_id,
    tokenHash: t.token_hash,
    familyId: t.family_id,
    expiresAt: t.expires_at,
    revokedAt: t.revoked_at,
  };
}

@Injectable()
export class PrismaRefreshTokensRepository implements RefreshTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(token: NewRefreshToken): Promise<RefreshTokenRow> {
    return toRow(
      await this.prisma.refresh_token.create({
        data: {
          user_id: token.userId,
          token_hash: token.tokenHash,
          family_id: token.familyId,
          expires_at: token.expiresAt,
        },
      }),
    );
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRow | undefined> {
    const found = await this.prisma.refresh_token.findUnique({ where: { token_hash: tokenHash } });
    return found ? toRow(found) : undefined;
  }

  /** One UPDATE … WHERE revoked_at IS NULL: only one of two concurrent refreshes can win. */
  async revokeIfActive(id: number): Promise<boolean> {
    const { count } = await this.prisma.refresh_token.updateMany({
      where: { id, revoked_at: null },
      data: { revoked_at: new Date() },
    });
    return count === 1;
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refresh_token.updateMany({
      where: { family_id: familyId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }
}
