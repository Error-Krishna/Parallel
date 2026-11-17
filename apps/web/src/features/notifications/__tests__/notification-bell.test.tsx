import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationBell } from '../notification-bell';

const pushMock = vi.fn();
const listMock = vi.fn();
const markReadMock = vi.fn();
const markAllReadMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/lib/api-client', () => ({
  api: {
    notifications: {
      list: (...args: unknown[]) => listMock(...args),
      markRead: (...args: unknown[]) => markReadMock(...args),
      markAllRead: (...args: unknown[]) => markAllReadMock(...args),
    },
  },
}));

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows unread badge count and allows marking individual and all notifications read', async () => {
    listMock.mockResolvedValue({
      unreadCount: 2,
      nextCursor: null,
      items: [
        {
          id: 'n-1',
          type: 'NEW_FOLLOWER',
          payload: { followerUsername: 'maya' },
          readAt: null,
          createdAt: '2026-11-18T10:00:00.000Z',
        },
        {
          id: 'n-2',
          type: 'QUEST_COMPLETED',
          payload: { questTitle: 'First Sketch', rewardValue: 'Sketch Badge' },
          readAt: null,
          createdAt: '2026-11-18T09:00:00.000Z',
        },
      ],
    });
    markReadMock.mockResolvedValue(undefined);
    markAllReadMock.mockResolvedValue({ updatedCount: 1 });

    const user = userEvent.setup();
    render(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByTestId('unread-badge').textContent).toBe('2');
    });

    await user.click(screen.getByRole('button', { name: /Notifications/i }));

    expect(
      await screen.findByText('@maya started following you'),
    ).toBeTruthy();
    expect(screen.getByText('Completed "First Sketch"')).toBeTruthy();

    const markButtons = screen.getAllByRole('button', {
      name: 'Mark notification as read',
    });
    await user.click(markButtons[0]);

    await waitFor(() => {
      expect(markReadMock).toHaveBeenCalledWith('n-1');
      expect(screen.getByTestId('unread-badge').textContent).toBe('1');
    });

    await user.click(screen.getByRole('button', { name: /Mark all read/i }));

    await waitFor(() => {
      expect(markAllReadMock).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('unread-badge')).toBeNull();
    });
  });

  it('shows a calm empty state when there are no notifications', async () => {
    listMock.mockResolvedValue({
      unreadCount: 0,
      nextCursor: null,
      items: [],
    });

    const user = userEvent.setup();
    render(<NotificationBell />);

    await user.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(await screen.findByText(/No notifications yet/i)).toBeTruthy();
  });
});
