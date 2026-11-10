import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { Prisma, type user } from '../../../generated/prisma/client.js';
import type { Role, TrustLevel, UserRow } from '../../../database/mock-database.js';
import {
  DuplicateUserError,
  UnknownLanguageError,
  type NewUser,
  type UsersRepository,
} from './users.repository.js';

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
 * displayName = COALESCE(display_name, username) (D-05).
 */
export function toUserRow(u: user): UserRow {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    passwordHash: u.password_hash,
    displayName: u.display_name ?? u.username,
    dbRole: u.role,
    status: u.status,
    ...ROLE_MAP[u.role],
  };
}

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** One query for all ids; ids that do not exist are simply missing from the result. */
  async findByIds(ids: number[]): Promise<UserRow[]> {
    const rows = await this.prisma.user.findMany({ where: { id: { in: ids } } });
    return rows.map(toUserRow);
  }

  async findById(id: number): Promise<UserRow | undefined> {
    const found = await this.prisma.user.findUnique({ where: { id } });
    return found ? toUserRow(found) : undefined;
  }

  async findByEmail(email: string): Promise<UserRow | undefined> {
    const found = await this.prisma.user.findUnique({ where: { email } });
    return found ? toUserRow(found) : undefined;
  }

  async findByUsername(username: string): Promise<UserRow | undefined> {
    const found = await this.prisma.user.findUnique({ where: { username } });
    return found ? toUserRow(found) : undefined;
  }

  async create(input: NewUser): Promise<UserRow> {
    const language = await this.prisma.language.findUnique({ where: { code: input.languageCode } });
    if (!language) throw new UnknownLanguageError();
    try {
      const created = await this.prisma.user.create({
        data: {
          username: input.username,
          email: input.email,
          password_hash: input.passwordHash,
          display_name: input.displayName,
          language_id: language.id,
        },
      });
      return toUserRow(created);
    } catch (e) {
      // Unique violation: tell email from username by the constrained fields.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const target = JSON.stringify(e.meta ?? {});
        throw new DuplicateUserError(target.includes('email') ? 'email' : 'username');
      }
      throw e;
    }
  }
}
