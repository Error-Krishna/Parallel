import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TwinsProcessor } from './twins.processor.js';

describe('TwinsProcessor', () => {
  let processor: TwinsProcessor;
  let usersService: {
    saveTwinMatch: ReturnType<typeof vi.fn>;
    getTwinCandidatePairs: ReturnType<typeof vi.fn>;
  };
  let twinsQueue: {
    addBulk: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    usersService = {
      saveTwinMatch: vi.fn(),
      getTwinCandidatePairs: vi.fn(),
    };

    twinsQueue = {
      addBulk: vi.fn(),
    };

    processor = new TwinsProcessor(
      usersService as never,
      twinsQueue as never,
    );
  });

  it('processes a specific Twin pair', async () => {
    usersService.saveTwinMatch.mockResolvedValue(null);

    await processor.process({
      data: {
        userAId: 'user-a',
        userBId: 'user-b',
      },
    } as never);

    expect(usersService.saveTwinMatch).toHaveBeenCalledWith(
      'user-a',
      'user-b',
    );
    expect(usersService.getTwinCandidatePairs).not.toHaveBeenCalled();
    expect(twinsQueue.addBulk).not.toHaveBeenCalled();
  });

  it('queues pruned candidate pairs in bulk with deduplicated jobIds', async () => {
    usersService.getTwinCandidatePairs.mockResolvedValue([
      ['user-a', 'user-b'],
      ['user-a', 'user-c'],
    ]);

    await processor.process({
      data: {},
    } as never);

    expect(twinsQueue.addBulk).toHaveBeenCalledTimes(1);
    expect(twinsQueue.addBulk).toHaveBeenCalledWith([
      {
        name: 'calculate-twin',
        data: { userAId: 'user-a', userBId: 'user-b' },
        opts: {
          jobId: 'calculate-twin-user-a-user-b',
          removeOnComplete: true,
          removeOnFail: 100,
        },
      },
      {
        name: 'calculate-twin',
        data: { userAId: 'user-a', userBId: 'user-c' },
        opts: {
          jobId: 'calculate-twin-user-a-user-c',
          removeOnComplete: true,
          removeOnFail: 100,
        },
      },
    ]);
  });

  it('queues no jobs when no pruned candidate pairs qualify', async () => {
    usersService.getTwinCandidatePairs.mockResolvedValue([]);

    await processor.process({
      data: {},
    } as never);

    expect(twinsQueue.addBulk).not.toHaveBeenCalled();
  });
});
