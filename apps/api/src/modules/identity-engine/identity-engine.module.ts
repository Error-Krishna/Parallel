import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { IdentityEngineService } from './identity-engine.service.js';
import { EmbeddingService } from './embedding.service.js';

@Module({
  imports: [UsersModule],
  providers: [IdentityEngineService, EmbeddingService],
  exports: [IdentityEngineService, EmbeddingService],
})
export class IdentityEngineModule {}
