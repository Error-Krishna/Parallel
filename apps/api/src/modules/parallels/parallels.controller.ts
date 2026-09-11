import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ParallelsService } from './parallels.service.js';

@Controller('parallels')
@UseGuards(JwtAuthGuard)
export class ParallelsController {
  constructor(private readonly parallelsService: ParallelsService) {}

  @Get('map')
  getMap(@CurrentUser() user: { id: string }) {
    return this.parallelsService.getMap(user.id);
  }
}
