import { Module } from '@nestjs/common';
import { repositoryProvider } from '../../config/data-source.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './controllers/auth.controller.js';
import { MockRefreshTokensRepository } from './repositories/mock-refresh-tokens.repository.js';
import { PrismaRefreshTokensRepository } from './repositories/prisma-refresh-tokens.repository.js';
import { REFRESH_TOKENS_REPOSITORY } from './repositories/refresh-tokens.repository.js';
import { AuthService } from './services/auth.service.js';
import { TokenService } from './services/token.service.js';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    repositoryProvider(REFRESH_TOKENS_REPOSITORY, MockRefreshTokensRepository, PrismaRefreshTokensRepository),
    AuthService,
    TokenService,
  ],
  exports: [TokenService],
})
export class AuthModule {}
