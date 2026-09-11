import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ParallelMapResponse,
  ParallelTypeDto,
} from '@parallel/shared-types';
import { PrismaService } from '../../database/prisma.service.js';
import { IdentityEngineService } from '../identity-engine/identity-engine.service.js';

@Injectable()
export class ParallelsService {
  constructor(
    private readonly identityEngine: IdentityEngineService,
    private readonly prisma: PrismaService,
  ) {}

  getMap(userId: string): Promise<ParallelMapResponse> {
    return this.identityEngine.getMap(userId);
  }

  async enterParallel(
    userId: string,
    parallelId: string,
  ): Promise<ParallelTypeDto> {
    const parallel = await this.prisma.parallelType.findUnique({
      where: { id: parallelId },
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
      },
    });

    if (!parallel) {
      throw new NotFoundException('Parallel not found');
    }

    await this.prisma.interestSignal.create({
      data: {
        userId,
        signalType: 'PARALLEL_ENTER',
        targetType: 'parallel_type',
        targetId: parallel.id,
        weight: 1.0,
      },
    });

    return parallel;
  }
}
