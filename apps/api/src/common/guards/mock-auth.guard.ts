import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from '../../modules/users/services/users.service.js';
import { ApiError } from '../errors/api-error.js';
import type { CurrentUserData } from '../decorators/current-user.decorator.js';

/**
 * TODO Phase B: replace with the real JWT guard (auth module).
 * Mock behaviour: `Authorization: Bearer <username>` logs that user in, resolved through the
 * user repository. In mock mode `jan` = trusted, `eva` = verified, `petr` = registered and anything
 * else = jan; in prisma mode an unknown username is a 401.
 */
@Injectable()
export class MockAuthGuard implements CanActivate {
  constructor(private readonly users: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: CurrentUserData }>();
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw ApiError.unauthorized();

    const user = await this.users.findByLogin(token);
    if (!user) throw ApiError.unauthorized();
    req.user = { id: user.id, displayName: user.displayName, role: user.role, trust: user.trust };
    return true;
  }
}
