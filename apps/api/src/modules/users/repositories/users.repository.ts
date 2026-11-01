import type { UserRow } from '../../../database/mock-database';

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

/** Data access for users. Only queries, no decisions. Implementations: Mock…, Prisma… */
export interface UsersRepository {
  findByIds(ids: number[]): Promise<UserRow[]>;
  /**
   * Login lookup of the mock auth guard: `Authorization: Bearer <username>`.
   * (Mock: matches the seed's mockToken, which equals the username.)
   */
  findByUsername(username: string): Promise<UserRow | undefined>;
}
