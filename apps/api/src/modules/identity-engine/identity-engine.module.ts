import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { UsersModule } from '../users/users.module.js';
import { JobsModule } from '../../jobs/jobs.module.js';
import { IdentityEngineService } from './identity-engine.service.js';
import { EmbeddingService } from './embedding.service.js';
import { GroqParallelNamingProvider } from './providers/groq-parallel-naming.provider.js';
import { EmergingParallelService } from './emerging-parallel.service.js';

@Module({
  imports: [
    UsersModule,
    JobsModule,
    BullModule.registerQueue({
      name: 'embedding',
    }),
  ],
  providers: [
    IdentityEngineService,
    EmbeddingService,
    EmergingParallelService,
    GroqParallelNamingProvider,
    {
      provide: 'ParallelNamingProvider',
      useExisting: GroqParallelNamingProvider,
    },
  ],
  exports: [IdentityEngineService, EmbeddingService, EmergingParallelService, GroqParallelNamingProvider],
})
export class IdentityEngineModule {}
