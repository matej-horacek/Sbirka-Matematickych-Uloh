import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Role, TrustLevel } from '../../database/mock-database';

/** The logged-in user, set by the auth guard. */
export interface CurrentUserData {
  id: number;
  displayName: string;
  role: Role;
  trust: TrustLevel;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): CurrentUserData => ctx.switchToHttp().getRequest().user,
);
