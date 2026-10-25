import { Injectable } from '@nestjs/common';
import { MockDatabase, type UserRow } from '../../../database/mock-database';

@Injectable()
export class UsersRepository {
  constructor(private readonly db: MockDatabase) {}

  findByIds(ids: number[]): UserRow[] {
    return this.db.users.filter((u) => ids.includes(u.id));
  }

  findByMockToken(token: string): UserRow | undefined {
    return this.db.users.find((u) => u.mockToken === token);
  }
}
