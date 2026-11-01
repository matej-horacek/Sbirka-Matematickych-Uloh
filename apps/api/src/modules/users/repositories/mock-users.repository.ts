import { Injectable } from '@nestjs/common';
import { MockDatabase, type UserRow } from '../../../database/mock-database';
import type { UsersRepository } from './users.repository';

@Injectable()
export class MockUsersRepository implements UsersRepository {
  constructor(private readonly db: MockDatabase) {}

  async findByIds(ids: number[]): Promise<UserRow[]> {
    return this.db.users.filter((u) => ids.includes(u.id));
  }

  async findByUsername(username: string): Promise<UserRow | undefined> {
    return this.db.users.find((u) => u.mockToken === username);
  }
}
