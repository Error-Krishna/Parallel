import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { CommunitiesService } from '../../modules/communities/communities.service.js';

@Processor('communities')
export class CommunitiesProcessor extends WorkerHost {
  constructor(
    private readonly communitiesService: CommunitiesService,
  ) {
    super();
  }

  async process(_job: Job): Promise<void> {
    await this.communitiesService.detectEmergentCommunities();
  }
}
