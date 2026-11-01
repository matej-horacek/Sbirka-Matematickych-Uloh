import { Injectable, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { Role, TrustLevel, UserRow } from '../../../database/mock-database';
import type { UsersRepository } from './users.repository';

/** user_role (DB) → the Role + TrustLevel pair the API works with. */
const ROLE_MAP = {
  SUPERADMIN: { role: 'ADMIN', trust: 'TRUSTED' },
  ADMIN: { role: 'ADMIN', trust: 'TRUSTED' },
  TRUSTED_TEACHER: { role: 'TEACHER', trust: 'TRUSTED' },
  VERIFIED_TEACHER: { role: 'TEACHER', trust: 'VERIFIED' },
  REGISTERED_TEACHER: { role: 'TEACHER', trust: 'REGISTERED' },
} as const satisfies Record<string, { role: Role; trust: TrustLevel }>;

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * TODO Daniel. Must do (DECISIONS D-05, spec UserRef):
   * - one query for all ids (`where: { id: { in: ids } }`), order does not matter (the caller builds a Map);
   * - map every row with the same mapping as `findByUsername` (displayName fallback, role/trust);
   * - ids that do not exist are simply missing from the result.
   */
  async findByIds(_ids: number[]): Promise<UserRow[]> {
    throw new NotImplementedException('TODO Daniel');
  }

  /**
   * DONE: needed for the mock login (`Authorization: Bearer <username>`).
   * - displayName = COALESCE(user.display_name, user.username)  (D-05);
   * - role/trust come from user.role (see ROLE_MAP); mockToken = username;
   * - unknown username → undefined (the guard answers 401).
   */
  async findByUsername(username: string): Promise<UserRow | undefined> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) return undefined;
    return {
      id: user.id,
      displayName: user.display_name ?? user.username,
      ...ROLE_MAP[user.role],
      mockToken: user.username,
    };
  }
}
