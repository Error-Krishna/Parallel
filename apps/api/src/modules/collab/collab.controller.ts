import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { CollabStatus } from '@parallel/shared-types';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { apiResponse } from '../../common/utils/api-response.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CollabService } from './collab.service.js';
import { CreateCollabDto } from './dto/create-collab.dto.js';
import { AcceptCollabDto } from './dto/accept-collab.dto.js';

@Controller('collab')
@UseGuards(JwtAuthGuard)
export class CollabController {
  constructor(private readonly collabService: CollabService) {}

  @Post('invite')
  async invite(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCollabDto,
  ) {
    const session = await this.collabService.invite(user.id, dto);
    return apiResponse(session, 'Collab invite sent successfully');
  }

  @Post(':id/accept')
  async accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AcceptCollabDto,
  ) {
    const session = await this.collabService.accept(user.id, id, dto);
    return apiResponse(session, 'Collab session started successfully');
  }

  @Post(':id/cancel')
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const session = await this.collabService.cancel(user.id, id);
    return apiResponse(session, 'Collab session cancelled');
  }

  @Post(':id/decline')
  async decline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const session = await this.collabService.cancel(user.id, id);
    return apiResponse(session, 'Collab invite declined');
  }

  @Post(':id/complete')
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const session = await this.collabService.complete(user.id, id);
    return apiResponse(session, 'Collab challenge progress updated');
  }

  @Get('sessions')
  async getSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: CollabStatus,
  ) {
    const sessions = await this.collabService.getSessions(user.id, status);
    return apiResponse(sessions, 'Collab sessions fetched successfully');
  }

  @Get('sessions/:id')
  async getSessionById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const session = await this.collabService.getSession(user.id, id);
    return apiResponse(session, 'Collab session fetched successfully');
  }

  @Get(':id')
  async getSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const session = await this.collabService.getSession(user.id, id);
    return apiResponse(session, 'Collab session fetched successfully');
  }
}
