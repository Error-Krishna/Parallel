import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PublicWrappedPage from '@/app/wrapped/[id]/page';

const pushMock = vi.fn();
const getWrappedMock = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'wrap-1' }),
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/features/auth/auth-store', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: false }),
}));

vi.mock('@/lib/api-client', () => ({
  api: {
    wrapped: {
      get: (...args: unknown[]) => getWrappedMock(...args),
    },
    cards: {
      create: vi.fn(),
    },
  },
}));

describe('PublicWrappedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('walks through the Wrapped story slides and displays computed highlights', async () => {
    getWrappedMock.mockResolvedValue({
      id: 'wrap-1',
      period: 'MONTHLY',
      periodStart: '2026-10-18T00:00:00.000Z',
      periodEnd: '2026-11-18T00:00:00.000Z',
      createdAt: '2026-11-18T00:00:00.000Z',
      username: 'maya',
      parallelNames: {
        'pt-1': 'Builder',
        'pt-2': 'Stargazer',
      },
      highlights: {
        biggestEvolution: { parallelTypeId: 'pt-1', deltaPct: 14 },
        mostExplored: { parallelTypeId: 'pt-1', interactionCount: 9 },
        weirdestIntersection: {
          parallelTypeIds: ['pt-1', 'pt-2'],
          note: 'Builder × Stargazer — a rare blend.',
        },
        streakHighlight: { parallelTypeId: 'pt-1', streakCount: 6 },
        twinId: null,
        narrativeCopy: 'Builder grew by 14% over the month.',
      },
    });

    const user = userEvent.setup();
    render(<PublicWrappedPage />);

    expect(await screen.findByText("@maya's Parallel Story")).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Next/i }));
    expect(screen.getByText('Builder +14%')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Next/i }));
    expect(screen.getByText('Builder × Stargazer')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Next/i }));
    expect(screen.getByRole('button', { name: /Copy recap link/i })).toBeTruthy();
  });
});
