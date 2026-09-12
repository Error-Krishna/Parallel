import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { QuestsService } from './quests.service.js';

@Controller('parallels')
@UseGuards(JwtAuthGuard)
export class QuestsController {
  constructor(private readonly questsService: QuestsService) {}

  @Get(':parallelId/quests')
  getQuests(
    @CurrentUser() user: { id: string },
    @Param('parallelId') parallelId: string,
  ) {
    return this.questsService.getQuests(user.id, parallelId);
  }

}
