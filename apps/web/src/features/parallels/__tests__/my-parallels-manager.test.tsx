import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserParallelDto } from '@parallel/shared-types';
import { MyParallelsManager } from '../my-parallels-manager';

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    parallels: {
      makePublic: vi.fn(),
      hide: vi.fn(),
      unhide: vi.fn(),
      dismiss: vi.fn(),
    },
  },
}));

vi.mock('@/lib/api-client', () => ({
  api: mockApi,
}));

function buildItem(overrides: Partial<UserParallelDto> = {}): UserParallelDto {
  return {
    id: 'up-1',
    parallelType: {
      id: 'pt-1',
      name: 'Builder',
      description: 'Turns ideas into things',
      icon: 'plus',
    },
    strengthPct: 40,
    momentum: 0,
    streakCount: 0,
    isGhost: false,
    isHidden: false,
    dismissedAt: null,
    suggestionReason: 'Based on your onboarding choices.',
    discoveredAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('MyParallelsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Public, Ghost, and Hidden statuses with plain-language explanations and supports publish, hide, unhide, and confirmed remove', async () => {
    const user = userEvent.setup();
    const initial: UserParallelDto[] = [
      buildItem({
        id: 'up-ghost',
        isGhost: true,
        isHidden: false,
        parallelType: {
          id: 'pt-urban',
          name: 'The Urbanist',
          description: 'City explorer',
          icon: 'compass',
        },
        suggestionReason: 'Emerged from your city saves.',
      }),
      buildItem({
        id: 'up-hidden',
        isGhost: false,
        isHidden: true,
        parallelType: {
          id: 'pt-synth',
          name: 'Synth Maker',
          description: 'Audio designer',
          icon: 'music',
        },
        suggestionReason: 'From your audio bookmarks.',
      }),
    ];

    mockApi.parallels.makePublic.mockResolvedValue({
      ...initial[0],
      isGhost: false,
    });
    mockApi.parallels.unhide.mockResolvedValue({
      ...initial[1],
      isHidden: false,
    });
    mockApi.parallels.dismiss.mockResolvedValue(undefined);

    function Harness() {
      const [items, setItems] = useState(initial);
      return <MyParallelsManager parallels={items} onChange={setItems} />;
    }

    render(<Harness />);

    expect(screen.getByText(/Ghost · Private/i)).toBeTruthy();
    expect(screen.getByText(/Hidden from map/i)).toBeTruthy();
    expect(screen.getByText(/Emerged from your city saves\./i)).toBeTruthy();

    // Publish Ghost Parallel
    await user.click(screen.getByRole('button', { name: /Make public/i }));
    await waitFor(() => {
      expect(mockApi.parallels.makePublic).toHaveBeenCalledWith('up-ghost');
      expect(screen.queryByText(/Ghost · Private/i)).toBeNull();
    });

    // Unhide hidden Parallel
    await user.click(screen.getByRole('button', { name: /Unhide/i }));
    await waitFor(() => {
      expect(mockApi.parallels.unhide).toHaveBeenCalledWith('up-hidden');
      expect(screen.queryByText(/Hidden from map/i)).toBeNull();
    });

    // Remove requires confirmation before calling dismiss
    const removeButtons = screen.getAllByRole('button', { name: /Remove/i });
    await user.click(removeButtons[0]);
    expect(mockApi.parallels.dismiss).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Confirm remove/i }));
    await waitFor(() => {
      expect(mockApi.parallels.dismiss).toHaveBeenCalledWith('up-ghost');
      expect(screen.queryByText('The Urbanist')).toBeNull();
    });
  });

  it('displays honest error message when an action fails', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    mockApi.parallels.unhide.mockRejectedValue(
      new Error('Could not reach server'),
    );

    render(
      <MyParallelsManager
        parallels={[buildItem({ id: 'up-err', isHidden: true })]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Unhide/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        'Could not reach server',
      );
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
