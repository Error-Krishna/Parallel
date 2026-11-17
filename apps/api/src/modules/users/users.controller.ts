import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Inject,
  Optional,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../jobs/redis.provider.js';
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
  constructor(
    private readonly usersService: UsersService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis,
  ) {}

  @Get('me')
  async getMe(@CurrentUser() currentUser: AuthenticatedUser) {
    const user = await this.usersService.findById(currentUser.id);

    return apiResponse(
      this.usersService.toPublicUser(user),
      'User profile fetched successfully',
    );
  }

  @Get('me/export')
  async exportMe(@CurrentUser() currentUser: AuthenticatedUser) {
    const exported = await this.usersService.exportUserData(currentUser.id);

    return apiResponse(exported, 'User data exported successfully');
  }

  @Delete('me')
  async deleteMe(@CurrentUser() currentUser: AuthenticatedUser) {
    await this.usersService.deleteAccount(currentUser.id);

    // Immediately revoke the active JWT in Redis so the deleted account's token
    // cannot be reused for any remaining TTL window (USER_FLOW.md Flow 14).
    if (this.redis && currentUser.jti) {
      const remainingSeconds = Math.max(
        1,
        currentUser.exp - Math.floor(Date.now() / 1000),
      );
      await this.redis.set(
        `auth:revoked:${currentUser.jti}`,
        '1',
        'EX',
        remainingSeconds,
      );
    }

    return apiResponse(null, 'Account deleted successfully');
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

  @Get(':userId/parallels')
  async getUserParallels(@Param('userId') userId: string) {
    const parallels = await this.usersService.getVisibleParallels(userId);

    return apiResponse(
      parallels,
      'User Parallels fetched successfully',
    );
  }

  @Get('twins')
  async getTwins(@CurrentUser() currentUser: AuthenticatedUser) {
    // Twin rows are kept fresh by a scheduled BullMQ job (every 15 minutes, see
    // jobs/twins/twins.module.ts) — this just reads what's already there.
    const twins = await this.usersService.getTwinMatches(currentUser.id);

    return apiResponse(
      twins,
      'Twin matches fetched successfully',
    );
  }

  @Post(':userId/follow')
  async followUser(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('userId') userId: string,
  ) {
    await this.usersService.followUser(currentUser.id, userId);

    return apiResponse(
      null,
      'User followed successfully',
    );
  }

  @Post(':userId/unfollow')
  async unfollowUser(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('userId') userId: string,
  ) {
    await this.usersService.unfollowUser(currentUser.id, userId);

    return apiResponse(
      null,
      'User unfollowed successfully',
    );
  }

  @Get('following')
  async getFollowing(@CurrentUser() currentUser: AuthenticatedUser) {
    const followingIds = await this.usersService.getFollowingIds(
      currentUser.id,
    );

    return apiResponse(
      followingIds,
      'Following users fetched successfully',
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
