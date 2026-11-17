import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PublicCardSharePage from '@/app/card/[id]/page';

const pushMock = vi.fn();
const getCardMock = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'card-123' }),
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/lib/api-client', () => ({
  api: {
    cards: {
      get: (...args: unknown[]) => getCardMock(...args),
    },
  },
}));

describe('PublicCardSharePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a public Identity Card with metadata, SVG preview, and share actions', async () => {
    getCardMock.mockResolvedValue({
      id: 'card-123',
      cardType: 'PARALLEL',
      sourceType: 'USER_PARALLEL',
      sourceId: 'up-1',
      imageUrl: '/v1/cards/card-123/image',
      createdAt: '2026-11-18T10:00:00.000Z',
      metadata: {
        username: 'maya',
        eyebrow: 'PARALLEL IDENTITY',
        title: 'Midnight Builder',
        subtitle: 'Ships side projects after sunset.',
        accentHex: '#7C5CFF',
        stats: [
          { label: 'Strength', value: '84%' },
          { label: 'Streak', value: '6d' },
        ],
      },
    });

    render(<PublicCardSharePage />);

    expect(await screen.findByText('Midnight Builder')).toBeTruthy();
    expect(screen.getByText('@maya')).toBeTruthy();
    expect(screen.getByText('84%')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Copy share link/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Download SVG/i })).toBeTruthy();

    const img = screen.getByRole('img', { name: 'Midnight Builder' });
    expect(img.getAttribute('src')).toContain('/v1/cards/card-123/image');
  });

  it('renders a clear unavailable state when the card does not exist', async () => {
    getCardMock.mockRejectedValue(new Error('404'));

    render(<PublicCardSharePage />);

    await waitFor(() => {
      expect(screen.getByText('Identity Card unavailable')).toBeTruthy();
    });
  });
});
