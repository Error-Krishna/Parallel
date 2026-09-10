import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import {
  ONBOARDING_QUESTIONS,
  OnboardingQuestion,
} from './onboarding.questions.js';
import { OnboardingAnswerDto } from './dto/onboarding-answer.dto.js';

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  getQuestions(): OnboardingQuestion[] {
    return ONBOARDING_QUESTIONS;
  }

  async saveAnswer(userId: string, dto: OnboardingAnswerDto): Promise<void> {
    const question = ONBOARDING_QUESTIONS.find(
      (item) => item.key === dto.questionKey,
    );

    if (!question) {
      throw new BadRequestException('Invalid onboarding question');
    }

    const validAnswer = question.options.some(
      (option) => option.value === dto.answerValue,
    );

    if (!validAnswer) {
      throw new BadRequestException('Invalid answer for this question');
    }

    await this.prisma.onboardingResponse.upsert({
      where: {
        userId_questionKey: {
          userId,
          questionKey: dto.questionKey,
        },
      },
      update: {
        answerValue: dto.answerValue,
      },
      create: {
        userId,
        questionKey: dto.questionKey,
        answerValue: dto.answerValue,
      },
    });
  }

  async getCompletionStatus(userId: string) {
    const answers = await this.prisma.onboardingResponse.findMany({
      where: { userId },
      select: {
        questionKey: true,
        answerValue: true,
      },
    });

    return {
      completed: answers.length === ONBOARDING_QUESTIONS.length,
      answeredCount: answers.length,
      totalQuestions: ONBOARDING_QUESTIONS.length,
      answers,
    };
  }
}
