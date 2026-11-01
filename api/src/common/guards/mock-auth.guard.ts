import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from '../../modules/users/services/users.service';
import { ApiError } from '../errors/api-error';
import type { CurrentUserData } from '../decorators/current-user.decorator';

/**
 * TODO Phase B: replace with the real JWT guard (auth module).
 * Mock behaviour: any `Authorization: Bearer <token>` logs you in.
 * `jan` = trusted, `eva` = verified, `petr` = registered; anything else = jan.
 */
@Injectable()
export class MockAuthGuard implements CanActivate {
  constructor(private readonly users: UsersService) {}

  canActivate(context: ExecutionContext): boolean {
  const req = context
    .switchToHttp()
    .getRequest<Request & { user?: CurrentUserData }>()

  // Development-only authentication bypass.
  const bypassAuth = process.env.MOCK_AUTH_BYPASS === 'true'

  const header = req.headers.authorization ?? ''
  const [scheme, token] = header.split(' ')

  // When bypassing authentication, always use Jan.
  const mockToken = bypassAuth
    ? 'jan'
    : scheme === 'Bearer'
      ? token
      : undefined

  if (!mockToken) {
    throw ApiError.unauthorized()
  }

  const user =
    this.users.findByMockToken(mockToken) ??
    this.users.findByMockToken('jan')

  if (!user) {
    throw ApiError.unauthorized()
  }

  // Still populate CurrentUser so controllers work normally.
  req.user = {
    id: user.id,
    displayName: user.displayName,
    role: user.role,
    trust: user.trust,
  }

  return true
}
}
