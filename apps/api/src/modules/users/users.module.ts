import { Module } from '@nestjs/common';
import { MockUsersRepository } from './repositories/mock-users.repository';
import { USERS_REPOSITORY } from './repositories/users.repository';
import { UsersService } from './services/users.service';

// No endpoints yet (accounts belong to the auth part). Other modules use the facade.
@Module({
  providers: [{ provide: USERS_REPOSITORY, useClass: MockUsersRepository }, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
