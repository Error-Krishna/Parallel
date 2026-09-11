import { Injectable } from '@nestjs/common';
import type { ParallelMapResponse } from '@parallel/shared-types';
import { IdentityEngineService } from '../identity-engine/identity-engine.service.js';

@Injectable()
export class ParallelsService {
  constructor(
    private readonly identityEngine: IdentityEngineService,
  ) {}

  getMap(userId: string): Promise<ParallelMapResponse> {
    return this.identityEngine.getMap(userId);
  }
}
