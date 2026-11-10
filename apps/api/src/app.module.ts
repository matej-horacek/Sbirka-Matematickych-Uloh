import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CsrfGuard } from './common/guards/csrf.guard.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ChaptersModule } from './modules/chapters/chapters.module.js';
import { LicensesModule } from './modules/licenses/licenses.module.js';
import { ProblemsModule } from './modules/problems/problems.module.js';
import { PublicationModule } from './modules/publication/publication.module.js';
import { TagsModule } from './modules/tags/tags.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [DatabaseModule, UsersModule, AuthModule, LicensesModule, TagsModule, ChaptersModule, ProblemsModule, PublicationModule],
  // Guards run in this order: CSRF header first (also for login/register), then the access-cookie login.
  // Every route needs a login except those marked @Public() (the spec's global cookieAuth).
  providers: [
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
