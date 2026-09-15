import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ParallelsService } from './parallels.service.js';
import { IdentityEngineService } from '../identity-engine/identity-engine.service.js';

@Controller('parallels')
@UseGuards(JwtAuthGuard)
export class ParallelsController {
  constructor(
    private readonly parallelsService: ParallelsService,
    private readonly identityEngine: IdentityEngineService,
  ) {}

  @Get('map')
  getMap(@CurrentUser() user: { id: string }) {
    return this.parallelsService.getMap(user.id);
  }

  @Get('evolution')
  getEvolution(@CurrentUser() user: { id: string }) {
    return this.identityEngine.getEvolution(user.id);
  }

  @Get(':parallelId/people')
  getPeople(
    @CurrentUser() user: { id: string },
    @Param('parallelId') parallelId: string,
  ) {
    return this.parallelsService.getPeople(user.id, parallelId);
  }

  @Get(':parallelId/feed')
  getFeed(
    @CurrentUser() user: { id: string },
    @Param('parallelId') parallelId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;

    return this.parallelsService.getFeed(
      user.id,
      parallelId,
      cursor,
      parsedLimit,
    );
  }

  @Get(':parallelId')
  getParallel(@Param('parallelId') parallelId: string) {
    return this.parallelsService.getParallel(parallelId);
  }

  @Post(':parallelId/enter')
  enterParallel(
    @CurrentUser() user: { id: string },
    @Param('parallelId') parallelId: string,
  ) {
    return this.parallelsService.enterParallel(user.id, parallelId);
  }
}
