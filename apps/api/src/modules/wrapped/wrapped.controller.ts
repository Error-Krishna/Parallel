import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { WrappedRecapDto } from '@parallel/shared-types';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { GenerateWrappedBodyDto } from './dto/generate-wrapped.dto.js';
import { WrappedService } from './wrapped.service.js';

@Controller('wrapped')
export class WrappedController {
  constructor(private readonly wrappedService: WrappedService) {}

  @Post('generate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateWrappedBodyDto,
  ): Promise<WrappedRecapDto> {
    return this.wrappedService.generateForUser(user.id, dto.period);
  }

  // Declared before `:id` so `/v1/wrapped/latest` matches statically.
  @Get('latest')
  @UseGuards(JwtAuthGuard)
  async getLatest(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WrappedRecapDto | null> {
    return this.wrappedService.getLatest(user.id);
  }

  // Public — powers shareable `/wrapped/[id]` story page without auth.
  @Get(':id')
  async getPublic(@Param('id') id: string): Promise<WrappedRecapDto> {
    return this.wrappedService.getPublicById(id);
  }
}
