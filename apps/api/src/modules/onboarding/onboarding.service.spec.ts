import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OnboardingService } from './onboarding.service.js';
import { PrismaService } from '../../database/prisma.service.js';

describe('OnboardingService', () => {
  let service: OnboardingService;

  let prisma: {
    onboardingResponse: {
      upsert: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      onboardingResponse: {
        upsert: vi.fn(),
        findMany: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns the configured onboarding questions', () => {
    const questions = service.getQuestions();

    expect(questions).toHaveLength(4);
    expect(questions[0].key).toBe('friday_night');
  });

  it('saves a valid onboarding answer', async () => {
    prisma.onboardingResponse.upsert.mockResolvedValue({});

    await service.saveAnswer('user-1', {
      questionKey: 'friday_night',
      answerValue: 'friends',
    });

    expect(prisma.onboardingResponse.upsert).toHaveBeenCalledWith({
      where: {
        userId_questionKey: {
          userId: 'user-1',
          questionKey: 'friday_night',
        },
      },
      update: {
        answerValue: 'friends',
      },
      create: {
        userId: 'user-1',
        questionKey: 'friday_night',
        answerValue: 'friends',
      },
    });
  });

  it('rejects an invalid answer', async () => {
    await expect(
      service.saveAnswer('user-1', {
        questionKey: 'friday_night',
        answerValue: 'invalid-answer',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.onboardingResponse.upsert).not.toHaveBeenCalled();
  });

  it('reports onboarding as incomplete when answers are missing', async () => {
    prisma.onboardingResponse.findMany.mockResolvedValue([
      {
        questionKey: 'friday_night',
        answerValue: 'friends',
      },
    ]);

    const result = await service.getCompletionStatus('user-1');

    expect(result).toEqual({
      completed: false,
      answeredCount: 1,
      totalQuestions: 4,
      answers: [
        {
          questionKey: 'friday_night',
          answerValue: 'friends',
        },
      ],
    });
  });

  it('reports onboarding as complete when all questions are answered', async () => {
    prisma.onboardingResponse.findMany.mockResolvedValue([
      {
        questionKey: 'friday_night',
        answerValue: 'friends',
      },
      {
        questionKey: 'learn_or_make',
        answerValue: 'learn',
      },
      {
        questionKey: 'plan_or_improvise',
        answerValue: 'plan',
      },
      {
        questionKey: 'natural_activity',
        answerValue: 'building',
      },
    ]);

    const result = await service.getCompletionStatus('user-1');

    expect(result.completed).toBe(true);
    expect(result.answeredCount).toBe(4);
    expect(result.totalQuestions).toBe(4);
  });
});
