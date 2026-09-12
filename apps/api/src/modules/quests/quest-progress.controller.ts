import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { QuestsService } from './quests.service.js';

@Controller('quests')
@UseGuards(JwtAuthGuard)
export class QuestProgressController {
  constructor(private readonly questsService: QuestsService) {}

  @Post(':questId/start')
  startQuest(
    @CurrentUser() user: { id: string },
    @Param('questId') questId: string,
  ) {
    return this.questsService.startQuest(user.id, questId);
  }
}
