import {
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { EmbeddingService } from '../../modules/identity-engine/embedding.service.js';
import { PrismaService } from '../../database/prisma.service.js';

interface EmbeddingJobData {
  userId: string;
}

@Injectable()
@Processor('embedding')
export class EmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingProcessor.name);

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<EmbeddingJobData>): Promise<void> {
    const { userId } = job.data;

    const parallels = await this.prisma.userParallel.findMany({
      where: {
        userId,
        isHidden: false,
        dismissedAt: null,
      },
      include: {
        parallelType: true,
      },
    });

    for (const parallel of parallels) {
      const signals = await this.prisma.interestSignal.findMany({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          signalType: true,
          weight: true,
        },
      });

      const signature = this.embeddingService.buildInterestSignature(
        parallel.parallelType.name,
        parallel.parallelType.description,
        signals,
      );

      const embedding = await this.embeddingService.generate(signature);

      await this.embeddingService.saveUserParallelEmbedding(
        parallel.id,
        embedding,
      );
    }

    const contentItems = await this.prisma.contentItem.findMany({
      select: {
        id: true,
        type: true,
        payload: true,
      },
    });

    for (const contentItem of contentItems) {
      const signature = this.embeddingService.buildContentSignature(
        contentItem.type,
        contentItem.payload,
      );

      const embedding = await this.embeddingService.generate(signature);

      await this.embeddingService.saveContentEmbedding(
        contentItem.id,
        embedding,
      );
    }

    this.logger.log(
      `Generated embeddings for ${parallels.length} Parallels and ${contentItems.length} content items for user ${userId}`,
    );
  }
}
