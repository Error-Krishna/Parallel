import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { OnboardingService } from './onboarding.service.js';
import { IdentityEngineService } from '../identity-engine/identity-engine.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { OnboardingAnswerDto } from './dto/onboarding-answer.dto.js';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly identityEngine: IdentityEngineService,
  ) {}

  @Get('questions')
  getQuestions() {
    return this.onboardingService.getQuestions();
  }

  @Post('answers')
  @HttpCode(HttpStatus.NO_CONTENT)
  async saveAnswer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: OnboardingAnswerDto,
  ): Promise<void> {
    await this.onboardingService.saveAnswer(user.id, dto);
  }

  @Get('status')
  async getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.onboardingService.getCompletionStatus(user.id);
  }

  @Post('complete')
  async complete(@CurrentUser() user: AuthenticatedUser) {
    return this.identityEngine.generateInitialMap(user.id);
  }
}
