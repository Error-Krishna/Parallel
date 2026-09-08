import { Body, Controller, Get, NotFoundException, Param, Patch, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('users')
@UseGuards(JwtAuthGuard) // every route below requires a valid JWT (blueprint's 🔒 in API.md §3)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() currentUser: AuthenticatedUser) {
    const user = await this.usersService.findById(currentUser.id);
    return this.usersService.toPublicUser(user);
  }

  @Patch('me')
  async updateMe(@CurrentUser() currentUser: AuthenticatedUser, @Body() dto: UpdateUserDto) {
    const user = await this.usersService.updateProfile(currentUser.id, dto);
    return this.usersService.toPublicUser(user);
  }

  @Get(':username')
  async getByUsername(@Param('username') username: string) {
    const user = await this.usersService.findByUsername(username);
    if (!user) {
      // Deliberately the same NotFoundException shape as findById — never leak whether
      // an email exists via a different error shape (basic account-enumeration hygiene).
      throw new NotFoundException('User not found');
    }
    return this.usersService.toPublicUser(user);
  }
}
