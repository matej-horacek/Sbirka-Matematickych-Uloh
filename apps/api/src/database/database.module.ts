import { Global, Module } from '@nestjs/common';
import { dataSource } from '../config/data-source.js';
import { MockDatabase } from './mock-database.js';
import { PrismaService } from './prisma.service.js';

// Only the store of the active DATA_SOURCE exists: the mock does not seed in prisma mode,
// and prisma mode does not connect in mock mode.
const store = dataSource() === 'prisma' ? PrismaService : MockDatabase;

@Global()
@Module({
  providers: [store],
  exports: [store],
})
export class DatabaseModule {}
