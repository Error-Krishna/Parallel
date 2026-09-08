import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

// Unit test for the controller — since UsersController has no logic of its own (it's
// pure routing, see apps/api/CLAUDE.md), this mostly confirms it calls the right
// service method and returns what the service gives it. UsersService is mocked, so
// this never touches Prisma or a real database.
describe('UsersController', () => {
  let controller: UsersController;
  let usersService: {
    findById: ReturnType<typeof vi.fn>;
    findByUsername: ReturnType<typeof vi.fn>;
    updateProfile: ReturnType<typeof vi.fn>;
    toPublicUser: ReturnType<typeof vi.fn>;
  };

  const currentUser = { id: '1', username: 'alex' };
  const fakeUserRow = { id: '1', username: 'alex', email: 'a@example.com', passwordHash: 'x', avatarUrl: null, bio: null };
  const fakePublicUser = { id: '1', username: 'alex', avatarUrl: null, bio: null };

  beforeEach(async () => {
    usersService = {
      findById: vi.fn().mockResolvedValue(fakeUserRow),
      findByUsername: vi.fn(),
      updateProfile: vi.fn().mockResolvedValue(fakeUserRow),
      toPublicUser: vi.fn().mockReturnValue(fakePublicUser),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    })
      // UsersController is decorated with @UseGuards(JwtAuthGuard) at the class level.
      // The real guard extends Passport's AuthGuard('jwt'), which needs AuthModuleOptions
      // — a provider that only exists inside AuthModule/PassportModule, not in this
      // deliberately minimal test module. overrideGuard() swaps it for a stub that always
      // allows the request through, so this test can focus purely on controller→service
      // wiring instead of re-testing auth (which auth.service.spec.ts already covers).
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(UsersController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('getMe returns the current user as a PublicUser', async () => {
    const result = await controller.getMe(currentUser);
    expect(usersService.findById).toHaveBeenCalledWith('1');
    expect(result).toEqual(fakePublicUser);
  });

  it('updateMe passes the DTO through to the service', async () => {
    const dto = { bio: 'new bio' };
    const result = await controller.updateMe(currentUser, dto);
    expect(usersService.updateProfile).toHaveBeenCalledWith('1', dto);
    expect(result).toEqual(fakePublicUser);
  });

  it('getByUsername returns a PublicUser when found', async () => {
    usersService.findByUsername.mockResolvedValue(fakeUserRow);
    const result = await controller.getByUsername('alex');
    expect(result).toEqual(fakePublicUser);
  });

  it('getByUsername throws NotFoundException when the user does not exist', async () => {
    usersService.findByUsername.mockResolvedValue(null);
    await expect(controller.getByUsername('nobody')).rejects.toThrow(NotFoundException);
  });
});
