import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsModule } from '../jobs.module.js';
import { IdentityEngineModule } from '../../modules/identity-engine/identity-engine.module.js';
import { EmbeddingProcessor } from './embedding.processor.js';

@Module({
  imports: [
    JobsModule,
    IdentityEngineModule,
    BullModule.registerQueue({
      name: 'embedding',
    }),
  ],
  providers: [EmbeddingProcessor],
})
export class EmbeddingModule {}
