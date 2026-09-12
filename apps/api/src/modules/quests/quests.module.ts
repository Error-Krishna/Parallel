import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { QuestsController } from './quests.controller.js';
import { QuestProgressController } from './quest-progress.controller.js';
import { QuestsService } from './quests.service.js';

@Module({
  imports: [AuthModule],
  controllers: [QuestsController, QuestProgressController],
  providers: [QuestsService],
})
export class QuestsModule {}
