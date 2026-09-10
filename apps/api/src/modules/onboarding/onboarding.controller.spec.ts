import { Test, TestingModule } from '@nestjs/testing';
import { OnboardingController } from './onboarding.controller.js';
import { OnboardingService } from './onboarding.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

describe('OnboardingController', () => {
  let controller: OnboardingController;

  const onboardingService = {
    getQuestions: vi.fn(),
    saveAnswer: vi.fn(),
    getCompletionStatus: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OnboardingController],
      providers: [
        {
          provide: OnboardingService,
          useValue: onboardingService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: () => true,
      })
      .compile();

    controller = module.get<OnboardingController>(OnboardingController);

    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns onboarding questions', () => {
    const questions = [
      {
        key: 'friday_night',
        question: 'Your ideal Friday night?',
        options: [],
      },
    ];

    onboardingService.getQuestions.mockReturnValue(questions);

    expect(controller.getQuestions()).toEqual(questions);
    expect(onboardingService.getQuestions).toHaveBeenCalledOnce();
  });

  it('saves an onboarding answer', async () => {
    onboardingService.saveAnswer.mockResolvedValue(undefined);

    const user = {
      id: 'user-1',
      jti: 'test-jti',
      exp: 9999999999,
    };

    const dto = {
      questionKey: 'friday_night',
      answerValue: 'friends',
    };

    await controller.saveAnswer(user, dto);

    expect(onboardingService.saveAnswer).toHaveBeenCalledWith(
      'user-1',
      dto,
    );
  });

  it('returns onboarding completion status', async () => {
    const status = {
      completed: false,
      answeredCount: 2,
      totalQuestions: 4,
      answers: [],
    };

    onboardingService.getCompletionStatus.mockResolvedValue(status);

    const user = {
      id: 'user-1',
      jti: 'test-jti',
      exp: 9999999999,
    };

    const result = await controller.getStatus(user);

    expect(result).toEqual(status);
    expect(onboardingService.getCompletionStatus).toHaveBeenCalledWith(
      'user-1',
    );
  });
});
