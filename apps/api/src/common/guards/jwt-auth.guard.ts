import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ErrorCode } from '@matematika/contracts';
import { ACCESS_COOKIE } from '../../modules/auth/auth-cookies.js';
import { TokenService } from '../../modules/auth/services/token.service.js';
import { UsersService } from '../../modules/users/services/users.service.js';
import type { CurrentUserData } from '../decorators/current-user.decorator.js';
import { IS_PUBLIC } from '../decorators/public.decorator.js';
import { ApiError } from '../errors/api-error.js';

/**
 * Global guard: the `access_token` cookie must hold a valid JWT of an existing, not blocked user.
 * The user is loaded on every request, so a block takes effect at once (not after the 15 min of the token).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: CurrentUserData }>();
    const token = (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
    if (!token) throw ApiError.unauthorized();
    const userId = await this.tokens.verifyAccessToken(token);
    if (userId === undefined) throw ApiError.unauthorized();

    const user = await this.users.findById(userId);
    if (!user) throw ApiError.unauthorized();
    if (user.status === 'BLOCKED') {
      throw ApiError.forbidden('Your account was blocked by moderation.', ErrorCode.ACCOUNT_BLOCKED);
    }
    req.user = { id: user.id, displayName: user.displayName, role: user.role, trust: user.trust };
    return true;
  }
}
