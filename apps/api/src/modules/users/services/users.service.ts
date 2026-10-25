import { Injectable } from '@nestjs/common';
import type { UserRef } from '@matematika/contracts';
import type { UserRow } from '../../../database/mock-database';
import { encodeId } from '../../../common/utils/ids';
import { UsersRepository } from '../repositories/users.repository';

/** Facade of the users module. */
@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  /** Batch lookup for enriching responses (one query for all authors on a page). */
  refsByIds(ids: number[]): Map<number, UserRef> {
    const unique = [...new Set(ids)];
    return new Map(this.repo.findByIds(unique).map((u) => [u.id, { id: encodeId(u.id), displayName: u.displayName }]));
  }

  findByMockToken(token: string): UserRow | undefined {
    return this.repo.findByMockToken(token);
  }
}
