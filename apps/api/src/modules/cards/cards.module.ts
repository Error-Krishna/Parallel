import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CardsController } from './cards.controller.js';
import { CardsService } from './cards.service.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [CardsController],
  providers: [CardsService],
  exports: [CardsService],
})
export class CardsModule {}
