import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { JobsModule } from '../jobs.module.js';
import { IdentityEngineModule } from '../../modules/identity-engine/identity-engine.module.js';
import { UsersModule } from '../../modules/users/users.module.js';
import { EmergingParallelProcessor } from './emerging-parallel.processor.js';

@Module({
  imports: [
    JobsModule,
    IdentityEngineModule,
    UsersModule,
    BullModule.registerQueue({
      name: 'emerging-parallel',
    }),
  ],
  providers: [EmergingParallelProcessor],
})
export class EmergingParallelModule implements OnModuleInit {
  constructor(
    @InjectQueue('emerging-parallel')
    private readonly emergingParallelQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.emergingParallelQueue.upsertJobScheduler(
      'detect-emerging-parallels',
      {
        every: 6 * 60 * 60 * 1000,
      },
      {
        name: 'detect-emerging-parallels',
        data: {},
      },
    );
  }
}
