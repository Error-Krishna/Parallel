import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PeopleTab } from '../../../app/parallel/[id]/page';
import type { PeopleDiscoveryDto, TwinMatchDto } from '@parallel/shared-types';

describe('PeopleTab component', () => {
  afterEach(() => {
    cleanup();
  });
  const mockRouter = {
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  };

  const samplePeople: PeopleDiscoveryDto[] = [
    {
      user: {
        id: 'user-2',
        username: 'taylor',
        avatarUrl: null,
        bio: 'City builder & coder',
      },
      parallels: [
        {
          id: 'p-gamer',
          name: 'Gamer',
          description: 'Plays games',
          icon: null,
        },
      ],
      sharedParallels: [
        {
          id: 'p-builder',
          name: 'Builder',
          description: 'Builds systems',
          icon: null,
        },
        {
          id: 'p-urbanist',
          name: 'Urbanist',
          description: 'Explores cities',
          icon: null,
        },
      ],
      explanation: 'Both exploring Builder + Urbanist',
    },
    {
      user: {
        id: 'user-3',
        username: 'alex',
        avatarUrl: null,
        bio: 'Just getting started',
      },
      parallels: [],
      sharedParallels: [
        {
          id: 'p-builder',
          name: 'Builder',
          description: 'Builds systems',
          icon: null,
        },
      ],
      explanation: 'Both exploring Builder',
    },
  ];

  it('renders loading indicator when loading', () => {
    render(
      <PeopleTab
        router={mockRouter as never}
        loading={true}
        people={null}
        followedIds={new Set()}
        twinMatches={[]}
        parallelName="Builder"
        onFollow={vi.fn()}
      />,
    );

    expect(screen.getByText('Finding people...')).toBeDefined();
  });

  it('renders empty state when no candidates found', () => {
    render(
      <PeopleTab
        router={mockRouter as never}
        loading={false}
        people={[]}
        followedIds={new Set()}
        twinMatches={[]}
        parallelName="Builder"
        onFollow={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/No one else has explored this Parallel publicly yet/i),
    ).toBeDefined();
  });

  it('renders multi-Parallel explanations and shared Parallel badges', () => {
    render(
      <PeopleTab
        router={mockRouter as never}
        loading={false}
        people={samplePeople}
        followedIds={new Set()}
        twinMatches={[]}
        parallelName="Builder"
        onFollow={vi.fn()}
      />,
    );

    expect(screen.getByText('@taylor')).toBeDefined();
    expect(screen.getByText('Both exploring Builder + Urbanist')).toBeDefined();
    expect(screen.getByText('City builder & coder')).toBeDefined();
    expect(screen.getByText('Also explores')).toBeDefined();
    expect(screen.getByText('Gamer')).toBeDefined();

    // Single-parallel candidate:
    expect(screen.getByText('@alex')).toBeDefined();
    expect(screen.getByText('Both exploring Builder')).toBeDefined();
  });

  it('renders Twin badge and navigates on click when candidate is a Twin', async () => {
    const user = userEvent.setup();
    const twinMatches: TwinMatchDto[] = [
      {
        id: 'twin-123',
        user: {
          id: 'user-2',
          username: 'taylor',
          avatarUrl: null,
          bio: null,
        },
        similarityScore: 84.5,
        sharedParallelTypeIds: ['p-builder', 'p-urbanist'],
        computedAt: '2026-09-01T00:00:00Z',
      },
    ];

    render(
      <PeopleTab
        router={mockRouter as never}
        loading={false}
        people={samplePeople}
        followedIds={new Set()}
        twinMatches={twinMatches}
        parallelName="Builder"
        onFollow={vi.fn()}
      />,
    );

    const twinButton = screen.getByText('Parallel Twin · 85%');
    expect(twinButton).toBeDefined();

    await user.click(twinButton);
    expect(mockRouter.push).toHaveBeenCalledWith('/twins/twin-123');
  });

  it('calls onFollow when Follow / Unfollow button is clicked', async () => {
    const user = userEvent.setup();
    const onFollowMock = vi.fn();

    render(
      <PeopleTab
        router={mockRouter as never}
        loading={false}
        people={samplePeople}
        followedIds={new Set(['user-2'])}
        twinMatches={[]}
        parallelName="Builder"
        onFollow={onFollowMock}
      />,
    );

    const unfollowButton = screen.getByRole('button', { name: /^Unfollow$/i });
    expect(unfollowButton).toBeDefined();
    await user.click(unfollowButton);
    expect(onFollowMock).toHaveBeenCalledWith('user-2');

    const followButton = screen.getByRole('button', { name: /^Follow$/i });
    expect(followButton).toBeDefined();
    await user.click(followButton);
    expect(onFollowMock).toHaveBeenCalledWith('user-3');
  });
});
