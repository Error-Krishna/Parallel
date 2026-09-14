import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TwinsProcessor } from './twins.processor.js';

describe('TwinsProcessor', () => {
  let processor: TwinsProcessor;
  let usersService: {
    saveTwinMatch: ReturnType<typeof vi.fn>;
    getTwinCandidateUserIds: ReturnType<typeof vi.fn>;
  };
  let twinsQueue: {
    add: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    usersService = {
      saveTwinMatch: vi.fn(),
      getTwinCandidateUserIds: vi.fn(),
    };

    twinsQueue = {
      add: vi.fn(),
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
    expect(usersService.getTwinCandidateUserIds).not.toHaveBeenCalled();
    expect(twinsQueue.add).not.toHaveBeenCalled();
  });

  it('queues every unique pair during a refresh', async () => {
    usersService.getTwinCandidateUserIds.mockResolvedValue([
      'user-a',
      'user-b',
      'user-c',
    ]);

    await processor.process({
      data: {},
    } as never);

    expect(twinsQueue.add).toHaveBeenCalledTimes(3);

    expect(twinsQueue.add).toHaveBeenNthCalledWith(
      1,
      'calculate-twin',
      {
        userAId: 'user-a',
        userBId: 'user-b',
      },
    );

    expect(twinsQueue.add).toHaveBeenNthCalledWith(
      2,
      'calculate-twin',
      {
        userAId: 'user-a',
        userBId: 'user-c',
      },
    );

    expect(twinsQueue.add).toHaveBeenNthCalledWith(
      3,
      'calculate-twin',
      {
        userAId: 'user-b',
        userBId: 'user-c',
      },
    );
  });

  it('queues no pairs when fewer than two users are eligible', async () => {
    usersService.getTwinCandidateUserIds.mockResolvedValue(['user-a']);

    await processor.process({
      data: {},
    } as never);

    expect(twinsQueue.add).not.toHaveBeenCalled();
  });
});
