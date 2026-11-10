import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { ErrorCode } from '@matematika/contracts';
import type { CurrentUser, RegisterRequest } from '@matematika/contracts';
import type { UserRow } from '../../../database/mock-database.js';
import { ApiError } from '../../../common/errors/api-error.js';
import { encodeId } from '../../../common/utils/ids.js';
import { authConfig } from '../../../config/auth-config.js';
import { DuplicateUserError, UnknownLanguageError } from '../../users/repositories/users.repository.js';
import { UsersService } from '../../users/services/users.service.js';
import { REFRESH_TOKENS_REPOSITORY, type RefreshTokensRepository } from '../repositories/refresh-tokens.repository.js';
import { TokenService } from './token.service.js';

/** Both tokens of a fresh session, to be put into cookies by the controller. */
export interface Session {
  user: CurrentUser;
  accessToken: string;
  refreshToken: string;
}

// Verified against when the email is unknown, so "no such email" takes as long as "wrong password".
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$etGr9EP72aYj1CmNssYmYw$JoTcKqF1TEb90z2W9rAd+flp7JQRQE23H9yyh4sJVs4';

export function toCurrentUser(u: UserRow): CurrentUser {
  return { id: encodeId(u.id), displayName: u.displayName, username: u.username, email: u.email, role: u.dbRole };
}

function blocked() {
  return ApiError.forbidden('Your account was blocked by moderation.', ErrorCode.ACCOUNT_BLOCKED);
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    @Inject(REFRESH_TOKENS_REPOSITORY) private readonly refreshTokens: RefreshTokensRepository,
  ) {}

  /** register: new REGISTERED_TEACHER, logged in right away. */
  async register(body: RegisterRequest): Promise<Session> {
    const passwordHash = await argon2.hash(body.password);
    let user: UserRow;
    try {
      user = await this.users.create({
        username: body.username.trim(),
        email: body.email.trim().toLowerCase(),
        passwordHash,
        displayName: body.displayName?.trim() || null,
        languageCode: body.language ?? 'cs',
      });
    } catch (e) {
      if (e instanceof DuplicateUserError) {
        throw e.field === 'email'
          ? ApiError.conflict(ErrorCode.EMAIL_TAKEN, 'An account with this email already exists.')
          : ApiError.conflict(ErrorCode.USERNAME_TAKEN, 'This username is already taken.');
      }
      if (e instanceof UnknownLanguageError) throw ApiError.badRequest('language: unknown language code');
      throw e;
    }
    return this.startSession(user, randomUUID());
  }

  /** login: password first, then the blocked check (checking earlier would reveal that the email exists). */
  async login(email: string, password: string): Promise<Session> {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    const ok = await this.passwordMatches(user?.passwordHash ?? DUMMY_HASH, password);
    if (!user || !ok) throw new ApiError(401, ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password.');
    if (user.status === 'BLOCKED') throw blocked();
    return this.startSession(user, randomUUID());
  }

  /**
   * refresh: rotates the token. An already revoked token being presented again means two parties
   * hold it (likely theft), so the whole family is revoked and the real user has to log in again.
   */
  async refresh(rawToken: string | undefined): Promise<Session> {
    if (!rawToken) throw ApiError.unauthorized();
    const row = await this.refreshTokens.findByHash(this.tokens.hashRefreshToken(rawToken));
    if (!row) throw ApiError.unauthorized();
    if (row.revokedAt) {
      await this.refreshTokens.revokeFamily(row.familyId);
      throw ApiError.unauthorized('This session is no longer valid. Log in again.');
    }
    if (row.expiresAt.getTime() <= Date.now()) throw ApiError.unauthorized('The session expired. Log in again.');

    const user = await this.users.findById(row.userId);
    if (!user) throw ApiError.unauthorized();
    if (user.status === 'BLOCKED') {
      await this.refreshTokens.revokeFamily(row.familyId);
      throw blocked();
    }
    // Lost a race with a parallel refresh of the same token: same as reuse.
    if (!(await this.refreshTokens.revokeIfActive(row.id))) {
      await this.refreshTokens.revokeFamily(row.familyId);
      throw ApiError.unauthorized('This session is no longer valid. Log in again.');
    }
    return this.startSession(user, row.familyId);
  }

  /** logout: always succeeds; revokes the session the cookie belongs to, if any. */
  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const row = await this.refreshTokens.findByHash(this.tokens.hashRefreshToken(rawToken));
    if (row) await this.refreshTokens.revokeFamily(row.familyId);
  }

  /**
   * argon2.verify throws (instead of returning false) when the stored value is not an argon2 hash,
   * e.g. the placeholder of the old seed in a database that was never re-seeded. That must be a
   * failed login, not a 500; the warning tells whoever runs the server what to fix.
   */
  private async passwordMatches(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      this.logger.warn('A stored password hash is not an argon2 hash. Re-seed the database (users need real hashes).');
      return false;
    }
  }

  private async startSession(user: UserRow, familyId: string): Promise<Session> {
    const refreshToken = this.tokens.newRefreshToken();
    await this.refreshTokens.create({
      userId: user.id,
      tokenHash: this.tokens.hashRefreshToken(refreshToken),
      familyId,
      expiresAt: new Date(Date.now() + authConfig().refreshTtlSeconds * 1000),
    });
    return { user: toCurrentUser(user), accessToken: await this.tokens.signAccessToken(user.id), refreshToken };
  }
}
