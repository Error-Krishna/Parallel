// Global module — import once in AppModule, then inject PrismaService anywhere
// via constructor injection without re-importing DatabaseModule everywhere.
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
