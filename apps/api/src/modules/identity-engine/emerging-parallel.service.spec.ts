import { describe, expect, it, vi } from 'vitest';
import { EmergingParallelService } from './emerging-parallel.service.js';

describe('EmergingParallelService', () => {
  it('accepts a coherent cluster that is sufficiently different from existing Parallels', () => {
    const prisma = {
      $queryRaw: vi.fn(),
    };

    const configService = {
      get: vi.fn(),
    };

    const namingProvider = {
      generateParallelIdentity: vi.fn(),
    };

    const embeddingService = {
      saveUserParallelEmbedding: vi.fn(),
    };

    const service = new EmergingParallelService(
      prisma as never,
      configService as never,
      namingProvider as never,
      embeddingService as never,
    );

    const result = service.evaluateNovelty(
      {
        size: 4,
        coherence: 0.735,
        strongestExistingSimilarity: 0.187,
      },
      {
        minimumClusterSize: 3,
        minimumCoherence: 0.7,
        maximumExistingSimilarity: 0.2,
      },
    );

    expect(result).toBe(true);
  });

  it('rejects a cluster that is too small', () => {
    const prisma = {
      $queryRaw: vi.fn(),
    };

    const configService = {
      get: vi.fn(),
    };

    const namingProvider = {
      generateParallelIdentity: vi.fn(),
    };

    const service = new EmergingParallelService(
      prisma as never,
      configService as never,
      namingProvider as never,
    );

    const result = service.evaluateNovelty(
      {
        size: 2,
        coherence: 0.8,
        strongestExistingSimilarity: 0.1,
      },
      {
        minimumClusterSize: 3,
        minimumCoherence: 0.7,
        maximumExistingSimilarity: 0.2,
      },
    );

    expect(result).toBe(false);
  });

  it('rejects a cluster with low coherence', () => {
    const prisma = {
      $queryRaw: vi.fn(),
    };

    const configService = {
      get: vi.fn(),
    };

    const namingProvider = {
      generateParallelIdentity: vi.fn(),
    };

    const service = new EmergingParallelService(
      prisma as never,
      configService as never,
      namingProvider as never,
    );

    const result = service.evaluateNovelty(
      {
        size: 4,
        coherence: 0.6,
        strongestExistingSimilarity: 0.1,
      },
      {
        minimumClusterSize: 3,
        minimumCoherence: 0.7,
        maximumExistingSimilarity: 0.2,
      },
    );

    expect(result).toBe(false);
  });

  it('rejects a cluster that is too similar to an existing Parallel', () => {
    const prisma = {
      $queryRaw: vi.fn(),
    };

    const configService = {
      get: vi.fn(),
    };

    const namingProvider = {
      generateParallelIdentity: vi.fn(),
    };

    const service = new EmergingParallelService(
      prisma as never,
      configService as never,
      namingProvider as never,
    );

    const result = service.evaluateNovelty(
      {
        size: 4,
        coherence: 0.8,
        strongestExistingSimilarity: 0.25,
      },
      {
        minimumClusterSize: 3,
        minimumCoherence: 0.7,
        maximumExistingSimilarity: 0.2,
      },
    );

    expect(result).toBe(false);
  });

  it('accepts a cluster when there is no existing Parallel similarity', () => {
    const prisma = {
      $queryRaw: vi.fn(),
    };

    const configService = {
      get: vi.fn(),
    };

    const namingProvider = {
      generateParallelIdentity: vi.fn(),
    };

    const service = new EmergingParallelService(
      prisma as never,
      configService as never,
      namingProvider as never,
    );

    const result = service.evaluateNovelty(
      {
        size: 4,
        coherence: 0.8,
        strongestExistingSimilarity: null,
      },
      {
        minimumClusterSize: 3,
        minimumCoherence: 0.7,
        maximumExistingSimilarity: 0.2,
      },
    );

    expect(result).toBe(true);
  });

  it('creates an emerging Parallel as a Ghost Parallel', async () => {
    const prisma = {
      parallelType: {
        create: vi.fn().mockResolvedValue({
          id: 'parallel-type-1',
        }),
      },
      userParallel: {
        create: vi.fn().mockResolvedValue({
          id: 'user-parallel-1',
        }),
      },
    };

    const configService = {
      get: vi.fn(),
    };

    const namingProvider = {
      generateParallelIdentity: vi.fn(),
    };

    const embeddingService = {
      saveUserParallelEmbedding: vi.fn(),
    };

    const service = new EmergingParallelService(
      prisma as never,
      configService as never,
      namingProvider as never,
      embeddingService as never,
    );

    const result =
      await service.createEmergingParallel(
        'user-1',
        {
          name: 'The Urbanist',
          description:
            'You are drawn to architecture, street art and city exploration.',
          icon: 'compass',
          strengthPct: 18,
          suggestionReason:
            'Your recent activity forms a strong cluster around architecture and urban exploration.',
          embedding: [0.1, 0.2, 0.3],
        },
      );

    expect(result).toEqual({
      parallelTypeId: 'parallel-type-1',
      userParallelId: 'user-parallel-1',
    });

    expect(
      prisma.parallelType.create,
    ).toHaveBeenCalledWith({
      data: {
        name: 'The Urbanist',
        description:
          'You are drawn to architecture, street art and city exploration.',
        icon: 'compass',
        isSystemGenerated: true,
      },
    });

    expect(
      prisma.userParallel.create,
    ).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        parallelTypeId: 'parallel-type-1',
        strengthPct: 18,
        isGhost: true,
        isHidden: false,
        suggestionReason:
          'Your recent activity forms a strong cluster around architecture and urban exploration.',
      },
    });

    expect(
      embeddingService.saveUserParallelEmbedding,
    ).toHaveBeenCalledWith(
      'user-parallel-1',
      [0.1, 0.2, 0.3],
    );
  });

  it('generates an identity for an emerging candidate', async () => {
    const prisma = {
      $queryRaw: vi.fn(),
    };

    const configService = {
      get: vi.fn(),
    };

    const namingProvider = {
      generateParallelIdentity: vi.fn().mockResolvedValue({
        name: 'Urban Explorer',
        description:
          'A recurring interest in architecture and city exploration.',
      }),
    };

    const service = new EmergingParallelService(
      prisma as never,
      configService as never,
      namingProvider as never,
    );

    const clusterSummary = {
      items: [
        {
          title: 'Architecture Walk',
          type: 'POST',
          description:
            'Explore interesting buildings while walking through the city.',
          signalWeight: 4,
        },
      ],
    };

    const result =
      await service.generateIdentityForCandidate({
        clusterSummary,
      });

    expect(result).toEqual({
      name: 'Urban Explorer',
      description:
        'A recurring interest in architecture and city exploration.',
    });

    expect(
      namingProvider.generateParallelIdentity,
    ).toHaveBeenCalledWith(clusterSummary);
  });

  it('builds an explainable suggestion reason from cluster activity', () => {
    const service = new EmergingParallelService(
      {} as never,
      {} as never,
      {} as never,
    );

    const reason = service['buildSuggestionReason']({
      items: [
        {
          title: 'Street Photography Basics',
          type: 'POST',
          description: 'Learn street photography.',
          signalWeight: 3,
        },
        {
          title: 'Finding Interesting Architecture',
          type: 'ARTICLE',
          description: 'Explore unusual architecture.',
          signalWeight: 4,
        },
        {
          title: 'Architecture Walk',
          type: 'POST',
          description: 'Walk through the city.',
          signalWeight: 4,
        },
      ],
    });

    expect(reason).toBe(
      'Suggested because your recent activity repeatedly connects with Finding Interesting Architecture, Architecture Walk, Street Photography Basics.',
    );
  });

  it('prepares identities only for novel emerging candidates', async () => {
    const prisma = {
      $queryRaw: vi.fn(),
    };

    const configService = {
      get: vi.fn((key: string) => {
        const values: Record<string, number> = {
          'app.emergingParallel.minimumClusterSize': 3,
          'app.emergingParallel.minimumCoherence': 0.7,
          'app.emergingParallel.maximumExistingSimilarity': 0.2,
        };

        return values[key];
      }),
    };

    const namingProvider = {
      generateParallelIdentity: vi.fn().mockResolvedValue({
        name: 'Urban Explorer',
        description:
          'A recurring interest in architecture and city exploration.',
      }),
    };

    const service = new EmergingParallelService(
      prisma as never,
      configService as never,
      namingProvider as never,
    );

    vi.spyOn(service, 'analyzeEmergingCandidates')
      .mockResolvedValue([
        {
          contentIds: ['content-1', 'content-2', 'content-3'],
          size: 3,
          coherence: 0.8,
          strongestExistingParallel: 'Explorer',
          strongestExistingSimilarity: 0.1,
          embedding: [1, 0],
          clusterSummary: {
            items: [
              {
                title: 'Architecture Walk',
                type: 'POST',
                description:
                  'Explore interesting buildings while walking through the city.',
                signalWeight: 4,
              },
            ],
          },
        },
        {
          contentIds: ['content-4'],
          size: 1,
          coherence: 0.9,
          strongestExistingParallel: null,
          strongestExistingSimilarity: null,
          embedding: [0, 1],
          clusterSummary: {
            items: [
              {
                title: 'Random Activity',
                type: 'POST',
                description: 'An unrelated activity.',
                signalWeight: 1,
              },
            ],
          },
        },
      ]);

    const result =
      await service.prepareEmergingParallel(
        'user-1',
        0.7,
      );

    expect(result).toHaveLength(1);
    expect(result[0].identity).toEqual({
      name: 'Urban Explorer',
      description:
        'A recurring interest in architecture and city exploration.',
    });

    expect(result[0].suggestionReason).toBe(
      'Suggested because you showed strong interest in Architecture Walk.',
    );

    expect(
      namingProvider.generateParallelIdentity,
    ).toHaveBeenCalledTimes(1);
  });

  it('analyzes coherent emerging clusters', async () => {
    const prisma = {
      interestSignal: {
        findMany: vi.fn().mockResolvedValue([
          { targetId: 'content-1', weight: 4 },
          { targetId: 'content-2', weight: 3 },
          { targetId: 'content-3', weight: 4 },
        ]),
      },
      contentItem: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'content-1',
            type: 'POST',
            payload: {
              title: 'Architecture',
              body: 'Architecture and city spaces.',
            },
          },
          {
            id: 'content-2',
            type: 'POST',
            payload: {
              title: 'City Walking',
              body: 'Walking through interesting cities.',
            },
          },
          {
            id: 'content-3',
            type: 'POST',
            payload: {
              title: 'Urban Photography',
              body: 'Photographing urban spaces.',
            },
          },
        ]),
      },
      userParallel: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'parallel-1',
            parallelType: {
              name: 'Explorer',
            },
          },
        ]),
      },
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([
          { embedding: '[1,0]' },
        ])
        .mockResolvedValueOnce([
          { embedding: '[0.99,0.01]' },
        ])
        .mockResolvedValueOnce([
          { embedding: '[0.98,0.02]' },
        ])
        .mockResolvedValue([
          { similarity: 0.2 },
        ]),
    };

    const configService = {
      get: vi.fn(),
    };

    const namingProvider = {
      generateParallelIdentity: vi.fn(),
    };

    const service = new EmergingParallelService(
      prisma as never,
      configService as never,
      namingProvider as never,
    );

    const result =
      await service.analyzeEmergingCandidates(
        'user-1',
        0.7,
      );

    expect(result).toHaveLength(1);
    expect(result[0].size).toBe(3);
    expect(result[0].contentIds).toEqual([
      'content-1',
      'content-2',
      'content-3',
    ]);
    expect(result[0].coherence).toBeGreaterThan(0.9);
    expect(
      result[0].strongestExistingParallel,
    ).toBe('Explorer');
    expect(
      result[0].strongestExistingSimilarity,
    ).toBe(0.2);
  });

  it('groups semantically similar items into clusters', () => {
    const prisma = {
      $queryRaw: vi.fn(),
    };

    const service = new EmergingParallelService(prisma as never);

    const clusters = service.buildSimilarityClusters(
      [
        {
          id: 'architecture-1',
          embedding: [1, 0],
          weight: 4,
        },
        {
          id: 'architecture-2',
          embedding: [0.99, 0.01],
          weight: 4,
        },
        {
          id: 'music-1',
          embedding: [0, 1],
          weight: 3,
        },
      ],
      0.7,
    );

    expect(clusters).toEqual([
      ['architecture-1', 'architecture-2'],
      ['music-1'],
    ]);
  });

  it('builds a user interest embedding from content signals', async () => {
    const prisma = {
      interestSignal: {
        findMany: vi.fn().mockResolvedValue([
          {
            targetId: 'content-1',
            weight: 3,
          },
          {
            targetId: 'content-2',
            weight: 1,
          },
        ]),
      },
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([
          {
            embedding: '[1,2,3]',
          },
        ])
        .mockResolvedValueOnce([
          {
            embedding: '[4,5,6]',
          },
        ]),
    };

    const service = new EmergingParallelService(prisma as never);

    const result = await service.buildUserInterestEmbedding(
      'user-1',
    );

    expect(result).toEqual([1.75, 2.75, 3.75]);
    expect(prisma.interestSignal.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('builds a weighted average interest embedding', () => {
    const prisma = {
      $queryRaw: vi.fn(),
    };

    const service = new EmergingParallelService(prisma as never);

    const result = service.buildWeightedInterestEmbedding([
      {
        embedding: [1, 2, 3],
        weight: 3,
      },
      {
        embedding: [4, 5, 6],
        weight: 1,
      },
    ]);

    expect(result).toEqual([1.75, 2.75, 3.75]);
  });

  it('returns null when there are no embeddings', () => {
    const prisma = {
      $queryRaw: vi.fn(),
    };

    const service = new EmergingParallelService(prisma as never);

    expect(
      service.buildWeightedInterestEmbedding([]),
    ).toBeNull();
  });

  it('reads a content embedding as a 384-dimensional number array', async () => {
    const prisma = {
      $queryRaw: vi
        .fn()
        .mockResolvedValue([
          {
            embedding: '[0.1,0.2,0.3]',
          },
        ]),
    };

    const service = new EmergingParallelService(prisma as never);

    const result = await service.getContentEmbedding('content-1');

    expect(result).toEqual([0.1, 0.2, 0.3]);
  });

  it('returns null when content has no embedding', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
    };

    const service = new EmergingParallelService(prisma as never);

    const result = await service.getContentEmbedding('content-1');

    expect(result).toBeNull();
  });

  it('returns similarity to a user Parallel', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          similarity: 0.82,
        },
      ]),
    };

    const service = new EmergingParallelService(prisma as never);

    const result = await service.getSimilarityToUserParallel(
      'parallel-1',
      [0.1, 0.2, 0.3],
    );

    expect(result).toBe(0.82);
  });

  it('returns null when the user Parallel has no embedding', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
    };

    const service = new EmergingParallelService(prisma as never);

    const result = await service.getSimilarityToUserParallel(
      'parallel-1',
      [0.1, 0.2, 0.3],
    );

    expect(result).toBeNull();
  });
});
