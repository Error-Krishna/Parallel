import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CommunitiesService } from './communities.service.js';

@Controller('communities')
@UseGuards(JwtAuthGuard)
export class CommunitiesController {
  constructor(
    private readonly communitiesService: CommunitiesService,
  ) {}

  @Post(':communityId/join')
  joinCommunity(
    @CurrentUser() user: { id: string },
    @Param('communityId') communityId: string,
  ) {
    return this.communitiesService.joinCommunity(user.id, communityId);
  }

  @Get()
  getCommunities() {
    return this.communitiesService.getCommunities();
  }
}
