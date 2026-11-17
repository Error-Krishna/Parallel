import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { apiResponse } from '../../common/utils/api-response.js';
import { SignupDto } from './dto/signup.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import {
  RateLimit,
  RedisRateLimitGuard,
} from '../../common/guards/rate-limit.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit({ limit: 30, windowSeconds: 60, keyPrefix: 'auth:signup' })
  async signup(@Body() dto: SignupDto) {
    const result = await this.authService.signup(dto);
    return apiResponse(result, 'Account created successfully');
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RedisRateLimitGuard)
  @RateLimit({ limit: 10, windowSeconds: 60, keyPrefix: 'auth:login' })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return apiResponse(result, 'Login successful');
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() currentUser: AuthenticatedUser) {
    await this.authService.logout(currentUser);
    return apiResponse(null, 'User logged out successfully');
  }
}
