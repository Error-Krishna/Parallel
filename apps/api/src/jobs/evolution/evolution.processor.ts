import {
  InjectQueue,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { IdentityEngineService } from '../../modules/identity-engine/identity-engine.service.js';
import { UsersService } from '../../modules/users/users.service.js';

interface EvolutionJobData {
  userId?: string;
}

@Injectable()
@Processor('evolution')
export class EvolutionProcessor extends WorkerHost {
  private readonly logger = new Logger(EvolutionProcessor.name);

  constructor(
    private readonly identityEngine: IdentityEngineService,
    private readonly usersService: UsersService,
    @InjectQueue('evolution') private readonly evolutionQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<EvolutionJobData>): Promise<void> {
    if (job.data.userId) {
      await this.identityEngine.recalculateScores(job.data.userId);

      this.logger.log(
        `Captured evolution snapshot for user ${job.data.userId}`,
      );

      return;
    }

    const userIds = await this.usersService.getEvolutionUserIds();

    for (const userId of userIds) {
      await this.evolutionQueue.add('capture-user-evolution', {
        userId,
      });
    }

    this.logger.log(
      `Queued evolution snapshots for ${userIds.length} users`,
    );
  }
}
