import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { UsersService } from '../../modules/users/users.service.js';

interface TwinJobData {
  userAId?: string;
  userBId?: string;
}

const TWIN_BULK_BATCH_SIZE = 500;

@Injectable()
@Processor('twins')
export class TwinsProcessor extends WorkerHost {
  private readonly logger = new Logger(TwinsProcessor.name);

  constructor(
    private readonly usersService: UsersService,
    @InjectQueue('twins') private readonly twinsQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<TwinJobData>): Promise<void> {
    if (job.data.userAId && job.data.userBId) {
      await this.usersService.saveTwinMatch(
        job.data.userAId,
        job.data.userBId,
      );
      return;
    }

    const candidatePairs = await this.usersService.getTwinCandidatePairs();

    if (candidatePairs.length === 0) {
      this.logger.log('Queued 0 Twin pairs (no qualifying candidate pairs)');
      return;
    }

    for (let i = 0; i < candidatePairs.length; i += TWIN_BULK_BATCH_SIZE) {
      const batch = candidatePairs.slice(i, i + TWIN_BULK_BATCH_SIZE);
      await this.twinsQueue.addBulk(
        batch.map(([userAId, userBId]) => ({
          name: 'calculate-twin',
          data: { userAId, userBId },
          opts: {
            // Deterministic jobId deduplicates overlapping scheduled runs.
            jobId: `calculate-twin-${userAId}-${userBId}`,
            removeOnComplete: true,
            removeOnFail: 100,
          },
        })),
      );
    }

    this.logger.log(`Queued ${candidatePairs.length} pruned Twin pairs`);
  }
}
