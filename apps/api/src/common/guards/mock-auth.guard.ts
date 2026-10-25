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
    const req = context.switchToHttp().getRequest<Request & { user?: CurrentUserData }>();
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw ApiError.unauthorized();

    const user = this.users.findByMockToken(token) ?? this.users.findByMockToken('jan')!;
    req.user = { id: user.id, displayName: user.displayName, role: user.role, trust: user.trust };
    return true;
  }
}
