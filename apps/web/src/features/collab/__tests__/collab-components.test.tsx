import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ParallelFusionCard } from '../components/parallel-fusion-card';
import { CollabChallengeView } from '../components/collab-challenge-view';
import { StartCollabModal } from '../components/start-collab-modal';
import type { CollabSessionDto } from '@parallel/shared-types';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/features/auth/auth-store';

vi.mock('@/lib/api-client', () => ({
  api: {
    users: {
      getUserParallels: vi.fn(),
    },
    collab: {
      invite: vi.fn(),
      complete: vi.fn(),
      cancel: vi.fn(),
    },
  },
}));

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('Collab Frontend Components', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const activeSession: CollabSessionDto = {
    id: 'collab-1',
    userAId: 'user-a',
    userBId: 'user-b',
    userA: {
      id: 'user-a',
      username: 'alice',
      avatarUrl: null,
      bio: null,
    },
    userB: {
      id: 'user-b',
      username: 'bob',
      avatarUrl: null,
      bio: null,
    },
    parallelTypeAId: 'pt-1',
    parallelTypeA: {
      id: 'pt-1',
      name: 'Explorer',
      description: 'Loves wandering',
      icon: 'compass',
    },
    parallelTypeBId: 'pt-2',
    parallelTypeB: {
      id: 'pt-2',
      name: 'Foodie',
      description: 'Loves tasting foods',
      icon: 'utensils',
    },
    status: 'ACTIVE',
    challengeTitle: 'Street Food Expedition',
    challengeDescription: 'Explore a new neighborhood and taste local street food.',
    challengeContext: {
      theme: 'Culinary Expedition',
    },
    userACompleted: false,
    userBCompleted: false,
    completedAt: null,
    createdAt: '2026-10-23T00:00:00Z',
    updatedAt: '2026-10-23T00:00:00Z',
  };

  describe('ParallelFusionCard', () => {
    it('renders both participants and their chosen Parallels when active', () => {
      render(<ParallelFusionCard session={activeSession} />);

      expect(screen.getByText('@alice')).toBeDefined();
      expect(screen.getByText('Explorer')).toBeDefined();
      expect(screen.getByText('@bob')).toBeDefined();
      expect(screen.getByText('Foodie')).toBeDefined();
      expect(screen.getByText('ACTIVE')).toBeDefined();
    });

    it('renders waiting state for user B when parallelTypeB is not chosen yet', () => {
      const pendingSession: CollabSessionDto = {
        ...activeSession,
        status: 'PENDING',
        parallelTypeBId: null,
        parallelTypeB: null,
      };

      render(<ParallelFusionCard session={pendingSession} />);

      expect(screen.getByText('@alice')).toBeDefined();
      expect(screen.getByText('Explorer')).toBeDefined();
      expect(screen.getByText('@bob')).toBeDefined();
      expect(screen.getByText('Choosing their Parallel...')).toBeDefined();
    });
  });

  describe('CollabChallengeView', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: {
          id: 'user-a',
          username: 'alice',
          avatarUrl: null,
          bio: null,
        },
        accessToken: 'token',
      });
    });

    it('renders challenge title, theme, and descriptions', () => {
      render(<CollabChallengeView session={activeSession} onUpdate={vi.fn()} />);

      expect(screen.getByText('Street Food Expedition')).toBeDefined();
      expect(screen.getByText('Culinary Expedition')).toBeDefined();
      expect(
        screen.getByText('Explore a new neighborhood and taste local street food.'),
      ).toBeDefined();
      expect(screen.getByRole('button', { name: /I Completed My Part/i })).toBeDefined();
    });

    it('calls api.collab.complete when complete button is clicked', async () => {
      const user = userEvent.setup();
      const onUpdateMock = vi.fn();
      const updatedSession: CollabSessionDto = {
        ...activeSession,
        userACompleted: true,
      };
      vi.mocked(api.collab.complete).mockResolvedValue(updatedSession);

      render(<CollabChallengeView session={activeSession} onUpdate={onUpdateMock} />);

      const button = screen.getByRole('button', { name: /I Completed My Part/i });
      await user.click(button);

      expect(api.collab.complete).toHaveBeenCalledWith('collab-1');
      expect(onUpdateMock).toHaveBeenCalledWith(updatedSession);
    });

    it('shows waiting text when current user already completed', () => {
      const userACompletedSession: CollabSessionDto = {
        ...activeSession,
        userACompleted: true,
      };

      render(
        <CollabChallengeView
          session={userACompletedSession}
          onUpdate={vi.fn()}
        />,
      );

      expect(
        screen.getByText(/You marked this complete! Waiting for @bob to finish./i),
      ).toBeDefined();
    });
  });

  describe('StartCollabModal', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: {
          id: 'user-a',
          username: 'alice',
          avatarUrl: null,
          bio: null,
        },
        accessToken: 'token',
      });

      vi.mocked(api.users.getUserParallels).mockResolvedValue([
        {
          id: 'up-1',
          parallelType: {
            id: 'pt-1',
            name: 'Explorer',
            description: 'Wanderer',
            icon: 'compass',
          },
          strengthPct: 75,
        },
      ]);
    });

    it('loads parallels and allows sending invite', async () => {
      const user = userEvent.setup();
      const onCloseMock = vi.fn();

      vi.mocked(api.collab.invite).mockResolvedValue({
        id: 'new-collab-id',
      } as never);

      render(
        <StartCollabModal
          targetUserId="user-b"
          targetUsername="bob"
          isOpen={true}
          onClose={onCloseMock}
        />,
      );

      expect(screen.getByText('Fuse identities with @bob')).toBeDefined();
      expect(await screen.findByText('Explorer')).toBeDefined();

      const sendButton = screen.getByRole('button', {
        name: /Send Collab Invite/i,
      });
      await user.click(sendButton);

      expect(api.collab.invite).toHaveBeenCalledWith({
        targetUserId: 'user-b',
        myParallelTypeId: 'pt-1',
      });
      expect(onCloseMock).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/collab/new-collab-id');
    });
  });
});
