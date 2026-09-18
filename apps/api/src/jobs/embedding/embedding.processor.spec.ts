import { Test, TestingModule } from '@nestjs/testing';
import type { Job } from 'bullmq';
import { EmbeddingProcessor } from './embedding.processor.js';
import { EmbeddingService } from '../../modules/identity-engine/embedding.service.js';
import { PrismaService } from '../../database/prisma.service.js';

describe('EmbeddingProcessor', () => {
  let processor: EmbeddingProcessor;

  const embeddingService = {
    buildInterestSignature: vi.fn().mockReturnValue('test signature'),
    generate: vi.fn().mockResolvedValue(
      Array.from({ length: 384 }, () => 0.1),
    ),
    saveUserParallelEmbedding: vi.fn().mockResolvedValue(undefined),
  };

  const prisma = {
    userParallel: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'up1',
          parallelType: {
            name: 'Music Head',
            description: 'Music and creative energy pull you in.',
          },
        },
      ]),
    },
    interestSignal: {
      findMany: vi.fn().mockResolvedValue([
        {
          signalType: 'LIKE',
          weight: 1,
        },
      ]),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingProcessor,
        {
          provide: EmbeddingService,
          useValue: embeddingService,
        },
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    processor = module.get(EmbeddingProcessor);
  });

  it('generates and saves an embedding for a user Parallel', async () => {
    const job = {
      data: {
        userId: 'user1',
      },
    } as Job<{ userId: string }>;

    await processor.process(job);

    expect(embeddingService.buildInterestSignature).toHaveBeenCalledWith(
      'Music Head',
      'Music and creative energy pull you in.',
      [{ signalType: 'LIKE', weight: 1 }],
    );

    expect(embeddingService.generate).toHaveBeenCalledWith(
      'test signature',
    );

    expect(
      embeddingService.saveUserParallelEmbedding,
    ).toHaveBeenCalledWith(
      'up1',
      expect.arrayContaining([0.1]),
    );
  });
});
