// Thin wrapper around PrismaClient, registered as a NestJS provider so it can be
// dependency-injected into any service (`constructor(private prisma: PrismaService)`)
// instead of every module creating its own client instance.
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
