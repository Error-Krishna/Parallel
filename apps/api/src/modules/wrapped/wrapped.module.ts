import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { WrappedController } from './wrapped.controller.js';
import { WrappedService } from './wrapped.service.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    NotificationsModule,
  ],
  controllers: [WrappedController],
  providers: [WrappedService],
  exports: [WrappedService],
})
export class WrappedModule {}
