import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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

  // Returns all non-dismissed Parallels owned by the caller (Public, Ghost, and Hidden)
  // so Profile > My Parallels can manage visibility and unhide hidden Parallels.
  @Get('manage')
  listManageable(@CurrentUser() user: { id: string }) {
    return this.parallelsService.listManageableParallels(user.id);
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

  // Publishes one of the authenticated user's Ghost Parallels (isGhost -> false)
  // so it becomes visible on their public profile, people discovery, twins, and collabs.
  @Post(':parallelId/make-public')
  @HttpCode(HttpStatus.OK)
  makeParallelPublic(
    @CurrentUser() user: { id: string },
    @Param('parallelId') parallelId: string,
  ) {
    return this.parallelsService.makeParallelPublic(user.id, parallelId);
  }

  @Patch(':parallelId/hide')
  hideParallel(
    @CurrentUser() user: { id: string },
    @Param('parallelId') parallelId: string,
  ) {
    return this.parallelsService.hideParallel(user.id, parallelId);
  }

  // Restores a previously hidden Parallel back onto the owner's map without changing isGhost.
  @Post(':parallelId/unhide')
  @HttpCode(HttpStatus.OK)
  unhideParallel(
    @CurrentUser() user: { id: string },
    @Param('parallelId') parallelId: string,
  ) {
    return this.parallelsService.unhideParallel(user.id, parallelId);
  }

  // Permanent soft-delete (sets dismissedAt) for Reject (Flow 3a) or Remove (Flow 14).
  @Delete(':parallelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  dismissParallel(
    @CurrentUser() user: { id: string },
    @Param('parallelId') parallelId: string,
  ) {
    return this.parallelsService.dismissParallel(user.id, parallelId);
  }
}
