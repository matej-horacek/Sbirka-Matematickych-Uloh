import type { UserRow } from '../../../database/mock-database.js';

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

export interface NewUser {
  username: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  /** language.code, e.g. "cs". */
  languageCode: string;
}

/** create() failed on a unique constraint. */
export class DuplicateUserError extends Error {
  constructor(readonly field: 'email' | 'username') {
    super(`${field} already taken`);
  }
}

/** create() got a language code that does not exist. */
export class UnknownLanguageError extends Error {}

/** Data access for users. Only queries, no decisions. Implementations: Mock…, Prisma… */
export interface UsersRepository {
  findByIds(ids: number[]): Promise<UserRow[]>;
  findById(id: number): Promise<UserRow | undefined>;
  /** Exact match; the caller normalizes (lowercases) the email. */
  findByEmail(email: string): Promise<UserRow | undefined>;
  findByUsername(username: string): Promise<UserRow | undefined>;
  /** New REGISTERED_TEACHER. Throws DuplicateUserError / UnknownLanguageError. */
  create(user: NewUser): Promise<UserRow>;
}
