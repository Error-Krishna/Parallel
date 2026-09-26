import {
  InjectQueue,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { UsersService } from '../../modules/users/users.service.js';
import { EmergingParallelService } from '../../modules/identity-engine/emerging-parallel.service.js';

interface EmergingParallelJobData {
  userId?: string;
}

@Injectable()
@Processor('emerging-parallel')
export class EmergingParallelProcessor extends WorkerHost {
  private readonly logger = new Logger(EmergingParallelProcessor.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly emergingParallelService: EmergingParallelService,
    @InjectQueue('emerging-parallel')
    private readonly emergingParallelQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<EmergingParallelJobData>): Promise<void> {
    if (job.data.userId) {
      const candidates =
        await this.emergingParallelService.prepareEmergingParallel(
          job.data.userId,
          this.emergingParallelService.getClusterSimilarityThreshold(),
        );

      for (const candidate of candidates) {
        await this.emergingParallelService.createEmergingParallel(
          job.data.userId,
          {
            name: candidate.identity.name,
            description: candidate.identity.description,
            strengthPct: 0,
            suggestionReason: candidate.suggestionReason,
            embedding: candidate.embedding,
          },
        );
      }

      this.logger.log(
        `Created ${candidates.length} emerging Parallel(s) for user ${job.data.userId}`,
      );

      return;
    }

    const userIds =
      await this.usersService.getEmergingParallelUserIds();

    for (const userId of userIds) {
      await this.emergingParallelQueue.add(
        'detect-user-emerging-parallels',
        { userId },
      );
    }

    this.logger.log(
      `Queued emerging Parallel detection for ${userIds.length} users`,
    );
  }
}
