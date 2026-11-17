import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IdentityCardType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../database/prisma.service.js';
import { renderIdentityCardSvg } from './card-svg.renderer.js';
import { CardsService } from './cards.service.js';

describe('CardsService', () => {
  let service: CardsService;
  let prisma: {
    user: { findUnique: ReturnType<typeof vi.fn> };
    userParallel: { findFirst: ReturnType<typeof vi.fn> };
    identityCard: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    prisma = {
      user: { findUnique: vi.fn() },
      userParallel: { findFirst: vi.fn() },
      identityCard: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
    };

    service = new CardsService(prisma as unknown as PrismaService);
  });

  it('creates an Identity Card for an owned public Parallel', async () => {
    const createdAt = new Date('2026-11-18T10:00:00.000Z');
    prisma.user.findUnique.mockResolvedValue({ username: 'maya' });
    prisma.userParallel.findFirst.mockResolvedValue({
      id: 'up-1',
      isGhost: false,
      isHidden: false,
      strengthPct: 74,
      streakCount: 5,
      parallelType: {
        name: 'Builder',
        description: 'Turns half-baked ideas into working tools.',
      },
    });
    prisma.identityCard.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...data,
        createdAt,
      }),
    );

    const result = await service.createCard('user-1', {
      cardType: IdentityCardType.PARALLEL,
      sourceId: 'up-1',
    });

    expect(result.id).toBeTruthy();
    expect(result.jobId).toBe(result.id);
    expect(result.card.imageUrl).toBe(`/v1/cards/${result.id}/image`);
    expect(result.card.metadata?.title).toBe('Builder');
    expect(result.card.metadata?.username).toBe('maya');
  });

  it('rejects card creation for a private Ghost Parallel', async () => {
    prisma.user.findUnique.mockResolvedValue({ username: 'maya' });
    prisma.userParallel.findFirst.mockResolvedValue({
      id: 'up-ghost',
      isGhost: true,
      isHidden: false,
      strengthPct: 60,
      streakCount: 0,
      parallelType: { name: 'Secret Side', description: 'Private.' },
    });

    await expect(
      service.createCard('user-1', {
        cardType: IdentityCardType.PARALLEL,
        sourceId: 'up-ghost',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.identityCard.create).not.toHaveBeenCalled();
  });

  it('throws 404 when source does not belong to the authenticated user', async () => {
    prisma.user.findUnique.mockResolvedValue({ username: 'maya' });
    prisma.userParallel.findFirst.mockResolvedValue(null);

    await expect(
      service.createCard('user-1', {
        cardType: IdentityCardType.PARALLEL,
        sourceId: 'other-users-parallel',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('escapes XML special characters in rendered SVG to prevent XSS', () => {
    const svg = renderIdentityCardSvg({
      cardId: 'card-1',
      cardType: IdentityCardType.PARALLEL,
      metadata: {
        username: 'maya',
        eyebrow: 'PARALLEL',
        title: '<script>alert("xss")</script> & Builder',
        subtitle: 'A "quoted" <subtitle>',
        accentHex: 'javascript:alert(1)',
        stats: [{ label: 'Streak', value: '7d' }],
      },
    });

    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(svg).toContain('#7C5CFF');
  });
});
