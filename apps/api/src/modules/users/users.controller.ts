import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { apiResponse } from '../../common/utils/api-response.js';
import { apiError } from '../../common/utils/api-error.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() currentUser: AuthenticatedUser) {
    const user = await this.usersService.findById(currentUser.id);

    return apiResponse(
      this.usersService.toPublicUser(user),
      'User profile fetched successfully',
    );
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: UpdateUserDto,
  ) {
    if (Object.keys(dto).length === 0) {
      apiError(
        'At least one profile field must be provided',
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = await this.usersService.updateProfile(
      currentUser.id,
      dto,
    );

    return apiResponse(
      this.usersService.toPublicUser(user),
      'User profile updated successfully',
    );
  }

  @Get(':username')
  async getByUsername(@Param('username') username: string) {
    const user = await this.usersService.findByUsername(username);

    if (!user) {
      apiError('User not found', HttpStatus.NOT_FOUND);
    }

    return apiResponse(
      this.usersService.toPublicUser(user),
      'User profile fetched successfully',
    );
  }
}
