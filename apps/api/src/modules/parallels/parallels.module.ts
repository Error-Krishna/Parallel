import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { IdentityEngineModule } from '../identity-engine/identity-engine.module.js';
import { ParallelsController } from './parallels.controller.js';
import { ParallelsService } from './parallels.service.js';

@Module({
  imports: [AuthModule, IdentityEngineModule],
  controllers: [ParallelsController],
  providers: [ParallelsService],
})
export class ParallelsModule {}
