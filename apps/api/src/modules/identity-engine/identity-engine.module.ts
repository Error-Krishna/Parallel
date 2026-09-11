import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { IdentityEngineService } from './identity-engine.service.js';

@Module({
  imports: [UsersModule],
  providers: [IdentityEngineService],
  exports: [IdentityEngineService],
})
export class IdentityEngineModule {}
