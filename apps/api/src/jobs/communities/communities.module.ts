import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { JobsModule } from '../jobs.module.js';
import { CommunitiesModule } from '../../modules/communities/communities.module.js';
import { CommunitiesProcessor } from './communities.processor.js';

@Module({
  imports: [
    JobsModule,
    CommunitiesModule,
    BullModule.registerQueue({
      name: 'communities',
    }),
  ],
  providers: [CommunitiesProcessor],
})
export class CommunitiesJobModule implements OnModuleInit {
  constructor(
    @InjectQueue('communities')
    private readonly communitiesQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.communitiesQueue.upsertJobScheduler(
      'detect-communities',
      {
        every: 6 * 60 * 60 * 1000,
      },
      {
        name: 'detect-communities',
        data: {},
      },
    );
  }
}
