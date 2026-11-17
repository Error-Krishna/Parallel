import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway.js';
import { AuthModule } from '../modules/auth/auth.module.js';

@Module({
  imports: [AuthModule],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
