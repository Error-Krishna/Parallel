import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CommunitiesController } from './communities.controller.js';
import { CommunitiesService } from './communities.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CommunitiesController],
  providers: [CommunitiesService],
  exports: [CommunitiesService],
})
export class CommunitiesModule {}
