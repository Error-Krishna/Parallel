import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollabController } from './collab.controller.js';
import type { CollabService } from './collab.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

describe('CollabController', () => {
  let controller: CollabController;
  let service: {
    invite: ReturnType<typeof vi.fn>;
    accept: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
    complete: ReturnType<typeof vi.fn>;
    getSessions: ReturnType<typeof vi.fn>;
    getSession: ReturnType<typeof vi.fn>;
  };

  const currentUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'alice@example.com',
  };

  beforeEach(() => {
    service = {
      invite: vi.fn(),
      accept: vi.fn(),
      cancel: vi.fn(),
      complete: vi.fn(),
      getSessions: vi.fn(),
      getSession: vi.fn(),
    };

    controller = new CollabController(service as unknown as CollabService);
  });

  it('delegates invite to service', async () => {
    const mockSession = { id: 's-1', status: 'PENDING' };
    service.invite.mockResolvedValue(mockSession);

    const dto = { toUsername: 'bob', myParallelTypeId: 'pt-1' };
    const res = await controller.invite(currentUser, dto);

    expect(service.invite).toHaveBeenCalledWith(currentUser.id, dto);
    expect(res.data).toEqual(mockSession);
    expect(res.success).toBe(true);
  });

  it('delegates accept to service', async () => {
    const mockSession = { id: 's-1', status: 'ACTIVE' };
    service.accept.mockResolvedValue(mockSession);

    const dto = { myParallelTypeId: 'pt-2' };
    const res = await controller.accept(currentUser, 's-1', dto);

    expect(service.accept).toHaveBeenCalledWith(currentUser.id, 's-1', dto);
    expect(res.data).toEqual(mockSession);
    expect(res.success).toBe(true);
  });

  it('delegates cancel to service', async () => {
    const mockSession = { id: 's-1', status: 'CANCELLED' };
    service.cancel.mockResolvedValue(mockSession);

    const res = await controller.cancel(currentUser, 's-1');

    expect(service.cancel).toHaveBeenCalledWith(currentUser.id, 's-1');
    expect(res.data).toEqual(mockSession);
    expect(res.success).toBe(true);
  });

  it('delegates complete to service', async () => {
    const mockSession = { id: 's-1', status: 'COMPLETED' };
    service.complete.mockResolvedValue(mockSession);

    const res = await controller.complete(currentUser, 's-1');

    expect(service.complete).toHaveBeenCalledWith(currentUser.id, 's-1');
    expect(res.data).toEqual(mockSession);
    expect(res.success).toBe(true);
  });

  it('delegates getSessions to service', async () => {
    const mockList = [{ id: 's-1' }];
    service.getSessions.mockResolvedValue(mockList);

    const res = await controller.getSessions(currentUser, 'ACTIVE');

    expect(service.getSessions).toHaveBeenCalledWith(currentUser.id, 'ACTIVE');
    expect(res.data).toEqual(mockList);
    expect(res.success).toBe(true);
  });

  it('delegates getSession to service', async () => {
    const mockSession = { id: 's-1' };
    service.getSession.mockResolvedValue(mockSession);

    const res = await controller.getSession(currentUser, 's-1');

    expect(service.getSession).toHaveBeenCalledWith(currentUser.id, 's-1');
    expect(res.data).toEqual(mockSession);
    expect(res.success).toBe(true);
  });
});
