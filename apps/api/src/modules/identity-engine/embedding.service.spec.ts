import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingService } from './embedding.service.js';
import { PrismaService } from '../../database/prisma.service.js';

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let prisma: {
    $executeRaw: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prisma = {
      $executeRaw: vi.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(EmbeddingService);
  });

  it('builds an interest signature', () => {
    const result = service.buildInterestSignature(
      'Music Head',
      'Music and creative energy pull you in.',
      [
        { signalType: 'LIKE', weight: 1 },
        { signalType: 'SAVE', weight: 2 },
      ],
    );

    expect(result).toContain('Parallel: Music Head');
    expect(result).toContain('LIKE (1)');
    expect(result).toContain('SAVE (2)');
  });

  it('generates a 384-dimensional embedding', async () => {
    const embedding = await service.generate('Parallel identity discovery');

    expect(embedding).toHaveLength(384);
    expect(embedding.every((value) => typeof value === 'number')).toBe(true);
  });

  it('writes the embedding through Prisma raw SQL', async () => {
    const embedding = Array.from({ length: 384 }, (_, index) => index / 384);

    await service.saveUserParallelEmbedding('up1', embedding);

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
