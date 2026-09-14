import {
  InjectQueue,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { UsersService } from '../../modules/users/users.service.js';

interface TwinJobData {
  userAId?: string;
  userBId?: string;
}

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

    const userIds = await this.usersService.getTwinCandidateUserIds();

    let queuedPairs = 0;

    for (let i = 0; i < userIds.length; i += 1) {
      for (let j = i + 1; j < userIds.length; j += 1) {
        await this.twinsQueue.add('calculate-twin', {
          userAId: userIds[i],
          userBId: userIds[j],
        });

        queuedPairs += 1;
      }
    }

    this.logger.log(
      `Queued ${queuedPairs} Twin pairs for ${userIds.length} users`,
    );
  }
}
