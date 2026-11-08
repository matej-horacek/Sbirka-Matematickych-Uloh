import { Injectable } from '@nestjs/common';
import { MockDatabase, type UserRow } from '../../../database/mock-database.js';
import {
  DuplicateUserError,
  UnknownLanguageError,
  type NewUser,
  type UsersRepository,
} from './users.repository.js';

/** Languages of the mock (the Prisma seed has the same one). */
const LANGUAGES = ['cs', 'sk', 'en'];

@Injectable()
export class MockUsersRepository implements UsersRepository {
  constructor(private readonly db: MockDatabase) {}

  async findByIds(ids: number[]): Promise<UserRow[]> {
    return this.db.users.filter((u) => ids.includes(u.id));
  }

  async findById(id: number): Promise<UserRow | undefined> {
    return this.db.users.find((u) => u.id === id);
  }

  async findByEmail(email: string): Promise<UserRow | undefined> {
    return this.db.users.find((u) => u.email === email);
  }

  async findByUsername(username: string): Promise<UserRow | undefined> {
    return this.db.users.find((u) => u.username === username);
  }

  async create(input: NewUser): Promise<UserRow> {
    if (!LANGUAGES.includes(input.languageCode)) throw new UnknownLanguageError();
    if (this.db.users.some((u) => u.email === input.email)) throw new DuplicateUserError('email');
    if (this.db.users.some((u) => u.username === input.username)) throw new DuplicateUserError('username');
    const row: UserRow = {
      id: this.db.newUserId(),
      username: input.username,
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName ?? input.username,
      dbRole: 'REGISTERED_TEACHER',
      status: 'ACTIVE',
      role: 'TEACHER',
      trust: 'REGISTERED',
    };
    this.db.users.push(row);
    return row;
  }
}
