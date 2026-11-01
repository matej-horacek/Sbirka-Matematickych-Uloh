import { Global, Module } from '@nestjs/common';
import { MockDatabase } from './mock-database';

// Phase B: replace MockDatabase with PrismaService here; repositories change, nothing else.
@Global()
@Module({
  providers: [MockDatabase],
  exports: [MockDatabase],
})
export class DatabaseModule {}
