import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmergingParallelProcessor } from './emerging-parallel.processor.js';

describe('EmergingParallelProcessor', () => {
  let processor: EmergingParallelProcessor;

  let usersService: {
    getEmergingParallelUserIds: ReturnType<typeof vi.fn>;
  };

  let emergingParallelService: {
    getClusterSimilarityThreshold: ReturnType<typeof vi.fn>;
    prepareEmergingParallel: ReturnType<typeof vi.fn>;
    createEmergingParallel: ReturnType<typeof vi.fn>;
  };

  let emergingParallelQueue: {
    add: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    usersService = {
      getEmergingParallelUserIds: vi.fn(),
    };

    emergingParallelService = {
      getClusterSimilarityThreshold: vi.fn().mockReturnValue(0.7),
      prepareEmergingParallel: vi.fn(),
      createEmergingParallel: vi.fn(),
    };

    emergingParallelQueue = {
      add: vi.fn(),
    };

    processor = new EmergingParallelProcessor(
      usersService as never,
      emergingParallelService as never,
      emergingParallelQueue as never,
    );
  });

  it('queues detection jobs for all eligible users', async () => {
    usersService.getEmergingParallelUserIds.mockResolvedValue([
      'user-a',
      'user-b',
      'user-c',
    ]);

    await processor.process({
      name: 'detect-emerging-parallels',
      data: {},
    } as never);

    expect(
      usersService.getEmergingParallelUserIds,
    ).toHaveBeenCalled();

    expect(emergingParallelQueue.add).toHaveBeenCalledTimes(3);

    expect(emergingParallelQueue.add).toHaveBeenNthCalledWith(
      1,
      'detect-user-emerging-parallels',
      { userId: 'user-a' },
    );

    expect(emergingParallelQueue.add).toHaveBeenNthCalledWith(
      2,
      'detect-user-emerging-parallels',
      { userId: 'user-b' },
    );

    expect(emergingParallelQueue.add).toHaveBeenNthCalledWith(
      3,
      'detect-user-emerging-parallels',
      { userId: 'user-c' },
    );
  });

  it('processes a specific user', async () => {
    emergingParallelService.prepareEmergingParallel.mockResolvedValue([]);

    await processor.process({
      name: 'detect-user',
      data: {
        userId: 'user-1',
      },
    } as never);

    expect(
      emergingParallelService.getClusterSimilarityThreshold,
    ).toHaveBeenCalled();

    expect(
      emergingParallelService.prepareEmergingParallel,
    ).toHaveBeenCalledWith('user-1', 0.7);

    expect(
      emergingParallelService.createEmergingParallel,
    ).not.toHaveBeenCalled();

    expect(
      usersService.getEmergingParallelUserIds,
    ).not.toHaveBeenCalled();
  });

  it('creates every prepared emerging Parallel for a user', async () => {
    emergingParallelService.prepareEmergingParallel.mockResolvedValue([
      {
        identity: {
          name: 'Urban Explorer',
          description: 'Explores cities and visual culture.',
        },
        suggestionReason:
          'Suggested because your recent activity connects with city exploration.',
        embedding: [0.1, 0.2, 0.3],
      },
      {
        identity: {
          name: 'Architecture Hunter',
          description: 'Enjoys discovering interesting architecture.',
        },
        suggestionReason:
          'Suggested because your recent activity connects with architecture.',
        embedding: [0.4, 0.5, 0.6],
      },
    ]);

    await processor.process({
      name: 'detect-user',
      data: {
        userId: 'user-1',
      },
    } as never);

    expect(
      emergingParallelService.createEmergingParallel,
    ).toHaveBeenCalledTimes(2);

    expect(
      emergingParallelService.createEmergingParallel,
    ).toHaveBeenNthCalledWith(
      1,
      'user-1',
      {
        name: 'Urban Explorer',
        description: 'Explores cities and visual culture.',
        strengthPct: 0,
        suggestionReason:
          'Suggested because your recent activity connects with city exploration.',
        embedding: [0.1, 0.2, 0.3],
      },
    );

    expect(
      emergingParallelService.createEmergingParallel,
    ).toHaveBeenNthCalledWith(
      2,
      'user-1',
      {
        name: 'Architecture Hunter',
        description: 'Enjoys discovering interesting architecture.',
        strengthPct: 0,
        suggestionReason:
          'Suggested because your recent activity connects with architecture.',
        embedding: [0.4, 0.5, 0.6],
      },
    );
  });

  it('does nothing when no users are eligible', async () => {
    usersService.getEmergingParallelUserIds.mockResolvedValue([]);

    await processor.process({
      name: 'detect-emerging-parallels',
      data: {},
    } as never);

    expect(
      usersService.getEmergingParallelUserIds,
    ).toHaveBeenCalled();

    expect(
      emergingParallelQueue.add,
    ).not.toHaveBeenCalled();

    expect(
      emergingParallelService.prepareEmergingParallel,
    ).not.toHaveBeenCalled();

    expect(
      emergingParallelService.createEmergingParallel,
    ).not.toHaveBeenCalled();
  });
});
