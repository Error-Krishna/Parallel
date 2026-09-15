import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class StreakService {
  constructor(private readonly prisma: PrismaService) {}

  async touch(userId: string, parallelTypeId: string) {
    const parallel = await this.prisma.userParallel.findUnique({
      where: {
        userId_parallelTypeId: {
          userId,
          parallelTypeId,
        },
      },
      select: {
        id: true,
        streakCount: true,
        streakLastTouchedAt: true,
      },
    });

    if (!parallel) {
      return null;
    }

    const now = new Date();
    const lastTouched = parallel.streakLastTouchedAt;

    const withinWindow =
      lastTouched !== null &&
      now.getTime() - lastTouched.getTime() <= 48 * 60 * 60 * 1000;

    const streakCount = withinWindow ? parallel.streakCount + 1 : 1;

    return this.prisma.userParallel.update({
      where: { id: parallel.id },
      data: {
        streakCount,
        streakLastTouchedAt: now,
      },
      select: {
        streakCount: true,
        streakLastTouchedAt: true,
      },
    });
  }
}
