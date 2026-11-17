import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { QuestsModule } from '../quests/quests.module.js';
import { CollabController } from './collab.controller.js';
import { CollabService } from './collab.service.js';

@Module({
  imports: [AuthModule, QuestsModule],
  controllers: [CollabController],
  providers: [CollabService],
  exports: [CollabService],
})
export class CollabModule {}
