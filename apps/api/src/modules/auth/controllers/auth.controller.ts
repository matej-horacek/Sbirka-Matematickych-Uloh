import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { zLoginBody, zRegisterBody } from '@matematika/contracts';
import type { CurrentUser as CurrentUserDto, LoginRequest, RegisterRequest } from '@matematika/contracts';
import { CurrentUser, type CurrentUserData } from '../../../common/decorators/current-user.decorator.js';
import { Public } from '../../../common/decorators/public.decorator.js';
import { ApiError } from '../../../common/errors/api-error.js';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import { UsersService } from '../../users/services/users.service.js';
import { REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from '../auth-cookies.js';
import { AuthService, toCurrentUser, type Session } from '../services/auth.service.js';

function cookie(req: Request, name: string): string | undefined {
  return (req.cookies as Record<string, string> | undefined)?.[name];
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  private reply(res: Response, session: Session): CurrentUserDto {
    setAuthCookies(res, session.accessToken, session.refreshToken);
    return session.user;
  }

  /** register – anyone; creates the account and logs in. */
  @Public()
  @Post('register')
  async register(
    @Body(new ZodValidationPipe(zRegisterBody)) body: RegisterRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CurrentUserDto> {
    return this.reply(res, await this.auth.register(body));
  }

  /** login – anyone. */
  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(zLoginBody)) body: LoginRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CurrentUserDto> {
    return this.reply(res, await this.auth.login(body.email, body.password));
  }

  /** getCurrentUser – the guard already checked the access cookie. */
  @Get('me')
  async me(@CurrentUser() user: CurrentUserData): Promise<CurrentUserDto> {
    const row = await this.users.findById(user.id);
    if (!row) throw ApiError.unauthorized();
    return toCurrentUser(row);
  }

  /** refreshSession – needs the refresh cookie only (the access token may already be expired). */
  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<CurrentUserDto> {
    return this.reply(res, await this.auth.refresh(cookie(req, REFRESH_COOKIE)));
  }

  /** logout – always 204, even with no or an invalid cookie. */
  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(cookie(req, REFRESH_COOKIE));
    clearAuthCookies(res);
  }
}
