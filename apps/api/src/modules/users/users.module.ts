import { Module } from '@nestjs/common';
import { UsersRepository } from './repositories/users.repository';
import { UsersService } from './services/users.service';

// No endpoints yet (accounts belong to the auth part). Other modules use the facade.
@Module({
  providers: [UsersRepository, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
