import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TwinMatchDto, UserParallelDto } from '@parallel/shared-types';
import { ParallelCard } from '../parallel-card';
import MapPage from '@/app/map/page';

const { mockPush, mockApi } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockApi: {
    parallels: {
      enter: vi.fn(),
      hide: vi.fn(),
      makePublic: vi.fn(),
      getMap: vi.fn(),
      getEvolution: vi.fn(),
    },
    users: {
      getTwins: vi.fn(),
    },
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('@/lib/api-client', () => ({
  api: mockApi,
}));

function buildParallel(overrides: Partial<UserParallelDto> = {}): UserParallelDto {
  return {
    id: 'up-ghost-1',
    parallelType: {
      id: 'pt-urbanist',
      name: 'The Urbanist',
      description: 'You are drawn to architecture and city exploration.',
      icon: 'compass',
    },
    strengthPct: 24,
    momentum: 1.5,
    streakCount: 0,
    isGhost: true,
    isHidden: false,
    dismissedAt: null,
    suggestionReason: 'Emerged from your recent saves around cities.',
    discoveredAt: '2026-10-15T12:00:00.000Z',
    ...overrides,
  };
}

describe('ParallelCard Ghost Mode visibility controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Ghost status badge and Make public action for Ghost Parallels', () => {
    render(
      <ParallelCard
        parallel={buildParallel({ isGhost: true })}
        index={0}
        onEnter={vi.fn()}
        onHide={vi.fn()}
        onPublished={vi.fn()}
      />,
    );

    expect(screen.getByText(/Ghost · Private/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Make public/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Hide/i })).toBeTruthy();
  });

  it('does not render Ghost badge or Make public action for already-public Parallels', () => {
    render(
      <ParallelCard
        parallel={buildParallel({ isGhost: false })}
        index={0}
        onEnter={vi.fn()}
        onHide={vi.fn()}
        onPublished={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Ghost · Private/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /Make public/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Hide/i })).toBeNull();
  });

  it('shows loading state and prevents repeated submissions while publishing', async () => {
    const user = userEvent.setup();
    let resolvePublish!: (value: UserParallelDto) => void;
    const pendingPromise = new Promise<UserParallelDto>((resolve) => {
      resolvePublish = resolve;
    });
    mockApi.parallels.makePublic.mockReturnValue(pendingPromise);

    const onPublished = vi.fn();
    const ghostParallel = buildParallel({ id: 'up-loading', isGhost: true });

    render(
      <ParallelCard
        parallel={ghostParallel}
        index={0}
        onEnter={vi.fn()}
        onHide={vi.fn()}
        onPublished={onPublished}
      />,
    );

    const button = screen.getByRole('button', { name: /Make public/i });
    await user.click(button);

    const loadingButton = screen.getByRole('button', { name: /Publishing\.\.\./i });
    expect((loadingButton as HTMLButtonElement).disabled).toBe(true);
    expect(loadingButton.getAttribute('aria-busy')).toBe('true');

    // Attempt repeated submission while in flight
    await user.click(loadingButton);
    expect(mockApi.parallels.makePublic).toHaveBeenCalledTimes(1);
    expect(mockApi.parallels.makePublic).toHaveBeenCalledWith('up-loading');

    const published = { ...ghostParallel, isGhost: false };
    resolvePublish(published);

    await waitFor(() => {
      expect(onPublished).toHaveBeenCalledWith(published);
    });
  });

  it('updates UI state and displays confirmation after successful publishing', async () => {
    const user = userEvent.setup();
    const initial = buildParallel({ id: 'up-publish-ok', isGhost: true });
    const published = { ...initial, isGhost: false };
    mockApi.parallels.makePublic.mockResolvedValue(published);

    function StatefulWrapper() {
      const [item, setItem] = useState(initial);
      return (
        <ParallelCard
          parallel={item}
          index={0}
          onEnter={vi.fn()}
          onHide={vi.fn()}
          onPublished={(updated) => setItem(updated)}
        />
      );
    }

    render(<StatefulWrapper />);

    expect(screen.getByText(/Ghost · Private/i)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Make public/i }));

    await waitFor(() => {
      expect(screen.queryByText(/Ghost · Private/i)).toBeNull();
    });

    expect(screen.queryByRole('button', { name: /Make public/i })).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/Published/i);
  });

  it('handles API failure honestly without showing success or clearing Ghost status', async () => {
    const user = userEvent.setup();
    const initial = buildParallel({ id: 'up-publish-fail', isGhost: true });
    const onPublished = vi.fn();
    mockApi.parallels.makePublic.mockRejectedValue(
      new Error('You do not have permission to publish this Parallel'),
    );

    render(
      <ParallelCard
        parallel={initial}
        index={0}
        onEnter={vi.fn()}
        onHide={vi.fn()}
        onPublished={onPublished}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Make public/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        'You do not have permission to publish this Parallel',
      );
    });

    expect(onPublished).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText(/Ghost · Private/i)).toBeTruthy();

    // Button re-enables for retry
    const retryButton = screen.getByRole('button', { name: /Make public/i });
    expect((retryButton as HTMLButtonElement).disabled).toBe(false);
  });

  it('MapPage immediately updates only the published Parallel without retaining stale Ghost status', async () => {
    const user = userEvent.setup();
    const ghostA = buildParallel({
      id: 'up-a',
      isGhost: true,
      parallelType: {
        id: 'pt-a',
        name: 'The Urbanist',
        description: 'City explorer',
        icon: 'compass',
      },
    });
    const ghostB = buildParallel({
      id: 'up-b',
      isGhost: true,
      parallelType: {
        id: 'pt-b',
        name: 'Synth Maker',
        description: 'Audio tinkerer',
        icon: 'music',
      },
    });

    mockApi.parallels.getMap.mockResolvedValue({
      user: { id: 'u-1', username: 'maya', avatarUrl: null, bio: null },
      parallels: [ghostA, ghostB],
    });
    mockApi.parallels.getEvolution.mockResolvedValue([]);
    mockApi.users.getTwins.mockResolvedValue([]);
    mockApi.parallels.makePublic.mockResolvedValue({
      ...ghostA,
      isGhost: false,
    });

    render(<MapPage />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'The Urbanist' }),
      ).toBeTruthy();
    });

    // Both Ghost cards initially display Ghost · Private and Make public
    expect(screen.getAllByText(/Ghost · Private/i)).toHaveLength(2);
    const publishButtons = screen.getAllByRole('button', { name: /Make public/i });
    expect(publishButtons).toHaveLength(2);

    // Publish only the first Ghost Parallel
    await user.click(publishButtons[0]);

    await waitFor(() => {
      expect(screen.getAllByText(/Ghost · Private/i)).toHaveLength(1);
    });

    expect(mockApi.parallels.makePublic).toHaveBeenCalledWith('up-a');
    expect(screen.getAllByRole('button', { name: /Make public/i })).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toMatch(/Published/i);
  });

  it('prevents an older out-of-order Twins refresh from overwriting newer Twins data across multiple publications', async () => {
    const user = userEvent.setup();
    const ghostA = buildParallel({
      id: 'up-race-a',
      isGhost: true,
      parallelType: {
        id: 'pt-race-a',
        name: 'The Urbanist',
        description: 'City explorer',
        icon: 'compass',
      },
    });
    const ghostB = buildParallel({
      id: 'up-race-b',
      isGhost: true,
      parallelType: {
        id: 'pt-race-b',
        name: 'Synth Maker',
        description: 'Audio tinkerer',
        icon: 'music',
      },
    });

    const staleTwin: TwinMatchDto = {
      id: 'twin-stale',
      user: { id: 'u-stale', username: 'stale_twin', avatarUrl: null, bio: null },
      similarityScore: 78,
      sharedParallelTypeIds: ['pt-race-a'],
      computedAt: '2026-11-18T00:00:00.000Z',
    };
    const latestTwin: TwinMatchDto = {
      id: 'twin-latest',
      user: { id: 'u-latest', username: 'latest_twin', avatarUrl: null, bio: null },
      similarityScore: 95,
      sharedParallelTypeIds: ['pt-race-a', 'pt-race-b'],
      computedAt: '2026-11-18T00:00:01.000Z',
    };

    let resolveTwinsAfterA!: (value: TwinMatchDto[]) => void;
    let resolveTwinsAfterB!: (value: TwinMatchDto[]) => void;

    mockApi.parallels.getMap.mockResolvedValue({
      user: { id: 'u-1', username: 'maya', avatarUrl: null, bio: null },
      parallels: [ghostA, ghostB],
    });
    mockApi.parallels.getEvolution.mockResolvedValue([]);
    mockApi.users.getTwins
      .mockResolvedValueOnce([]) // initial map load
      .mockImplementationOnce(
        () =>
          new Promise<TwinMatchDto[]>((resolve) => {
            resolveTwinsAfterA = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<TwinMatchDto[]>((resolve) => {
            resolveTwinsAfterB = resolve;
          }),
      );

    mockApi.parallels.makePublic
      .mockResolvedValueOnce({ ...ghostA, isGhost: false })
      .mockResolvedValueOnce({ ...ghostB, isGhost: false });

    render(<MapPage />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'The Urbanist' }),
      ).toBeTruthy();
    });

    // Publish first Ghost Parallel -> triggers getTwins() request #2
    await user.click(screen.getAllByRole('button', { name: /Make public/i })[0]);
    await waitFor(() => {
      expect(mockApi.users.getTwins).toHaveBeenCalledTimes(2);
    });

    // Publish second Ghost Parallel before request #2 resolves -> triggers getTwins() request #3
    await user.click(screen.getByRole('button', { name: /Make public/i }));
    await waitFor(() => {
      expect(mockApi.users.getTwins).toHaveBeenCalledTimes(3);
    });

    // Resolve the NEWER request (#3) first
    await act(async () => {
      resolveTwinsAfterB([latestTwin]);
      await Promise.resolve();
    });

    const twinButton = screen.getByRole('button', {
      name: /View your Parallel Twin/i,
    });
    expect(twinButton.getAttribute('title')).toContain('@latest_twin');

    // Now resolve the STALE older request (#2) — it must NOT overwrite latestTwin
    await act(async () => {
      resolveTwinsAfterA([staleTwin]);
      await Promise.resolve();
    });

    expect(twinButton.getAttribute('title')).toContain('@latest_twin');
    await user.click(twinButton);
    expect(mockPush).toHaveBeenCalledWith('/twins/twin-latest');
  });

  it('ignores outstanding Twins refreshes after MapPage unmounts', async () => {
    const user = userEvent.setup();
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const ghost = buildParallel({ id: 'up-unmount', isGhost: true });
    const postUnmountTwin: TwinMatchDto = {
      id: 'twin-after-unmount',
      user: {
        id: 'u-late',
        username: 'late_twin',
        avatarUrl: null,
        bio: null,
      },
      similarityScore: 88,
      sharedParallelTypeIds: ['pt-urbanist'],
      computedAt: '2026-11-18T00:00:02.000Z',
    };

    let resolveLateTwins!: (value: TwinMatchDto[]) => void;

    mockApi.parallels.getMap.mockResolvedValue({
      user: { id: 'u-1', username: 'maya', avatarUrl: null, bio: null },
      parallels: [ghost],
    });
    mockApi.parallels.getEvolution.mockResolvedValue([]);
    mockApi.users.getTwins
      .mockResolvedValueOnce([])
      .mockImplementationOnce(
        () =>
          new Promise<TwinMatchDto[]>((resolve) => {
            resolveLateTwins = resolve;
          }),
      );
    mockApi.parallels.makePublic.mockResolvedValue({
      ...ghost,
      isGhost: false,
    });

    const { unmount } = render(<MapPage />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'The Urbanist' }),
      ).toBeTruthy();
    });

    await user.click(screen.getByRole('button', { name: /Make public/i }));
    await waitFor(() => {
      expect(mockApi.users.getTwins).toHaveBeenCalledTimes(2);
    });

    // Unmount while the Twins refresh promise is still pending
    unmount();

    // Resolving after unmount must not trigger state updates or React errors
    await act(async () => {
      resolveLateTwins([postUnmountTwin]);
      await Promise.resolve();
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
