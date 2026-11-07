import { Injectable} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import type { user } from '../../../generated/prisma/client.js';
import type { Role, TrustLevel, UserRow } from '../../../database/mock-database.js';
import type { UsersRepository } from './users.repository.js';

/** user_role (DB) → the Role + TrustLevel pair the API works with. */
const ROLE_MAP = {
  SUPERADMIN: { role: 'ADMIN', trust: 'TRUSTED' },
  ADMIN: { role: 'ADMIN', trust: 'TRUSTED' },
  TRUSTED_TEACHER: { role: 'TEACHER', trust: 'TRUSTED' },
  VERIFIED_TEACHER: { role: 'TEACHER', trust: 'VERIFIED' },
  REGISTERED_TEACHER: { role: 'TEACHER', trust: 'REGISTERED' },
} as const satisfies Record<string, { role: Role; trust: TrustLevel }>;

/**
 * DB user → UserRow (also used by the test StoreProbe, and by findByIds).
 * displayName = COALESCE(display_name, username) (D-05); mockToken = username.
 */
export function toUserRow(u: user): UserRow {
  return { id: u.id, displayName: u.display_name ?? u.username, ...ROLE_MAP[u.role], mockToken: u.username };
}

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * - one query for all ids (`where: { id: { in: ids } }`), order does not matter (the caller builds a Map);
   * - map every row with `toUserRow` (displayName fallback, role/trust);
   * - ids that do not exist are simply missing from the result.
   */
  async findByIds(ids: number[]): Promise<UserRow[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        id: { in: ids },
      }
    });
    return rows.map(toUserRow);
  }

  /**
   * DONE: needed for the mock login (`Authorization: Bearer <username>`).
   * - displayName = COALESCE(user.display_name, user.username)  (D-05);
   * - role/trust come from user.role (see ROLE_MAP); mockToken = username;
   * - unknown username → undefined (the guard answers 401).
   */
  async findByUsername(username: string): Promise<UserRow | undefined> {
    const found = await this.prisma.user.findUnique({ where: { username } });
    return found ? toUserRow(found) : undefined;
  }
}
