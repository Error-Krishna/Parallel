import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ParallelsService } from './parallels.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { IdentityEngineService } from '../identity-engine/identity-engine.service.js';
import { StreakService } from '../quests/streak.service.js';

describe('ParallelsService', () => {
  let service: ParallelsService;

  let prisma: {
    contentItem: Record<string, ReturnType<typeof vi.fn>>;
    interestSignal: Record<string, ReturnType<typeof vi.fn>>;
  };

  let streakService: {
    touch: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prisma = {
      contentItem: {
        findUnique: vi.fn(),
      },
      interestSignal: {
        create: vi.fn(),
      },
    };

    streakService = {
      touch: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParallelsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: IdentityEngineService,
          useValue: {},
        },
        {
          provide: StreakService,
          useValue: streakService,
        },
      ],
    }).compile();

    service = module.get(ParallelsService);
  });

  it('creates a content interaction and touches the Parallel streak', async () => {
    prisma.contentItem.findUnique.mockResolvedValue({
      id: 'content-1',
      parallelTypeId: 'parallel-1',
    });

    await service.createContentInteraction(
      'user-1',
      'content-1',
      'LIKE',
    );

    expect(prisma.interestSignal.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        signalType: 'LIKE',
        targetType: 'content',
        targetId: 'content-1',
        weight: 1.0,
      },
    });

    expect(streakService.touch).toHaveBeenCalledWith(
      'user-1',
      'parallel-1',
    );
  });

  it('rejects a missing content item without touching a streak', async () => {
    prisma.contentItem.findUnique.mockResolvedValue(null);

    await expect(
      service.createContentInteraction(
        'user-1',
        'missing-content',
        'LIKE',
      ),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.interestSignal.create).not.toHaveBeenCalled();
    expect(streakService.touch).not.toHaveBeenCalled();
  });
});
