import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsModule } from '../jobs.module.js';
import { UsersModule } from '../../modules/users/users.module.js';
import { TwinsProcessor } from './twins.processor.js';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';

@Module({
  imports: [
    JobsModule,
    UsersModule,
    BullModule.registerQueue({
      name: 'twins',
    }),
  ],
  providers: [TwinsProcessor],
})
export class TwinsModule implements OnModuleInit {
  constructor(
    @InjectQueue('twins') private readonly twinsQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.twinsQueue.upsertJobScheduler(
      'refresh-twins',
      {
        every: 15 * 60 * 1000,
      },
      {
        name: 'refresh-twin-pairs',
        data: {},
      },
    );
  }
}
