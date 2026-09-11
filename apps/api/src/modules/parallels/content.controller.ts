import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ContentInteractionDto } from './dto/content-interaction.dto.js';
import { ParallelsService } from './parallels.service.js';

@Controller('content')
@UseGuards(JwtAuthGuard)
export class ContentController {
  constructor(private readonly parallelsService: ParallelsService) {}

  @Get(':contentId')
  getContent(@Param('contentId') contentId: string) {
    return this.parallelsService.getContent(contentId);
  }

  @Post(':contentId/interactions')
  @HttpCode(HttpStatus.NO_CONTENT)
  async createInteraction(
    @CurrentUser() user: { id: string },
    @Param('contentId') contentId: string,
    @Body() dto: ContentInteractionDto,
  ): Promise<void> {
    await this.parallelsService.createContentInteraction(
      user.id,
      contentId,
      dto.signalType,
    );
  }
}
