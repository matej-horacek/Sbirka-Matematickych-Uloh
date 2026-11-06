import { Module } from '@nestjs/common';
import { repositoryProvider } from '../../config/data-source.js';
import { MockUsersRepository } from './repositories/mock-users.repository.js';
import { PrismaUsersRepository } from './repositories/prisma-users.repository.js';
import { USERS_REPOSITORY } from './repositories/users.repository.js';
import { UsersService } from './services/users.service.js';

// No endpoints yet (accounts belong to the auth part). Other modules use the facade.
@Module({
  providers: [repositoryProvider(USERS_REPOSITORY, MockUsersRepository, PrismaUsersRepository), UsersService],
  exports: [UsersService],
})
export class UsersModule {}
