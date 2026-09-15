import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { JobsModule } from '../jobs.module.js';
import { IdentityEngineModule } from '../../modules/identity-engine/identity-engine.module.js';
import { UsersModule } from '../../modules/users/users.module.js';
import { EvolutionProcessor } from './evolution.processor.js';

@Module({
  imports: [
    JobsModule,
    IdentityEngineModule,
    UsersModule,
    BullModule.registerQueue({
      name: 'evolution',
    }),
  ],
  providers: [EvolutionProcessor],
})
export class EvolutionModule implements OnModuleInit {
  constructor(
    @InjectQueue('evolution') private readonly evolutionQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.evolutionQueue.upsertJobScheduler(
      'capture-evolution',
      {
        every: 30 * 24 * 60 * 60 * 1000,
      },
      {
        name: 'capture-evolution-snapshots',
        data: {},
      },
    );
  }
}
