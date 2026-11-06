import { Inject, Injectable } from '@nestjs/common';
import type { UserRef } from '@matematika/contracts';
import type { UserRow } from '../../../database/mock-database.js';
import { dataSource } from '../../../config/data-source.js';
import { encodeId } from '../../../common/utils/ids.js';
import { USERS_REPOSITORY, type UsersRepository } from '../repositories/users.repository.js';

/** Facade of the users module. */
@Injectable()
export class UsersService {
  constructor(@Inject(USERS_REPOSITORY) private readonly repo: UsersRepository) {}

  /** Batch lookup for enriching responses (one query for all authors on a page). */
  async refsByIds(ids: number[]): Promise<Map<number, UserRef>> {
    const unique = [...new Set(ids)];
    return new Map((await this.repo.findByIds(unique)).map((u) => [u.id, { id: encodeId(u.id), displayName: u.displayName }]));
  }

  /**
   * Mock login: `Bearer <username>`. In mock mode an unknown name falls back to `jan` (as always);
   * in prisma mode it is simply not found (→ 401).
   */
  async findByLogin(token: string): Promise<UserRow | undefined> {
    const user = await this.repo.findByUsername(token);
    if (user || dataSource() !== 'mock') return user;
    return this.repo.findByUsername('jan');
  }
}
