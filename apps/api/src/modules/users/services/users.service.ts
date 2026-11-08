import { Inject, Injectable } from '@nestjs/common';
import type { UserRef } from '@matematika/contracts';
import type { UserRow } from '../../../database/mock-database.js';
import { encodeId } from '../../../common/utils/ids.js';
import { USERS_REPOSITORY, type NewUser, type UsersRepository } from '../repositories/users.repository.js';

/** Facade of the users module. */
@Injectable()
export class UsersService {
  constructor(@Inject(USERS_REPOSITORY) private readonly repo: UsersRepository) {}

  /** Batch lookup for enriching responses (one query for all authors on a page). */
  async refsByIds(ids: number[]): Promise<Map<number, UserRef>> {
    const unique = [...new Set(ids)];
    return new Map(
      (await this.repo.findByIds(unique)).map((u) => [u.id, { id: encodeId(u.id), displayName: u.displayName }]),
    );
  }

  findById(id: number): Promise<UserRow | undefined> {
    return this.repo.findById(id);
  }

  findByEmail(email: string): Promise<UserRow | undefined> {
    return this.repo.findByEmail(email);
  }

  /** Throws DuplicateUserError / UnknownLanguageError (the auth service maps them to API errors). */
  create(user: NewUser): Promise<UserRow> {
    return this.repo.create(user);
  }
}
