import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  CreateIdentityCardResponse,
  IdentityCardDto,
} from '@parallel/shared-types';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CardsService } from './cards.service.js';
import { CreateIdentityCardBodyDto } from './dto/create-identity-card.dto.js';

@Controller('cards')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateIdentityCardBodyDto,
  ): Promise<CreateIdentityCardResponse> {
    return this.cardsService.createCard(user.id, dto);
  }

  // Declared before `:id` so `/v1/cards/me` matches statically.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async listMine(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IdentityCardDto[]> {
    return this.cardsService.listMine(user.id);
  }

  // Public — shareable SVG card asset rendered on demand with zero paid external storage.
  @Get(':id/image')
  @Header('Content-Type', 'image/svg+xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  @Header('X-Content-Type-Options', 'nosniff')
  async getImage(@Param('id') cardId: string): Promise<string> {
    return this.cardsService.getCardSvg(cardId);
  }

  // Public — powers `/card/[id]` share page without requiring authentication.
  @Get(':id')
  async getPublic(@Param('id') cardId: string): Promise<IdentityCardDto> {
    return this.cardsService.getPublicCard(cardId);
  }
}
