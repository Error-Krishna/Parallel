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

    let streakCount = 1;

    if (lastTouched !== null) {
      const nowDay = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
      );
      const lastTouchedDay = Date.UTC(
        lastTouched.getUTCFullYear(),
        lastTouched.getUTCMonth(),
        lastTouched.getUTCDate(),
      );
      const dayDifference = Math.floor(
        (nowDay - lastTouchedDay) / (24 * 60 * 60 * 1000),
      );

      if (dayDifference === 0) {
        streakCount = parallel.streakCount;
      } else if (dayDifference === 1) {
        streakCount = parallel.streakCount + 1;
      }
    }

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
