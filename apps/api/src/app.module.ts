import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MockAuthGuard } from './common/guards/mock-auth.guard';
import { DatabaseModule } from './database/database.module';
import { ChaptersModule } from './modules/chapters/chapters.module';
import { LicensesModule } from './modules/licenses/licenses.module';
import { ProblemsModule } from './modules/problems/problems.module';
import { PublicationModule } from './modules/publication/publication.module';
import { TagsModule } from './modules/tags/tags.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    DatabaseModule,
    UsersModule,
    LicensesModule,
    TagsModule,
    ChaptersModule,
    ProblemsModule,
    PublicationModule,
  ],
  // Every route needs a login (the spec's global bearerAuth).
  providers: [{ provide: APP_GUARD, useClass: MockAuthGuard }],
})
export class AppModule {}
