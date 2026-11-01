import { Module } from '@nestjs/common';
import { repositoryProvider } from '../../config/data-source';
import { MockUsersRepository } from './repositories/mock-users.repository';
import { PrismaUsersRepository } from './repositories/prisma-users.repository';
import { USERS_REPOSITORY } from './repositories/users.repository';
import { UsersService } from './services/users.service';

// No endpoints yet (accounts belong to the auth part). Other modules use the facade.
@Module({
  providers: [repositoryProvider(USERS_REPOSITORY, MockUsersRepository, PrismaUsersRepository), UsersService],
  exports: [UsersService],
})
export class UsersModule {}
