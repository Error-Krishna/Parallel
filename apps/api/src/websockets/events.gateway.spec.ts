import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import {
  EventsGateway,
  extractHandshakeToken,
} from './events.gateway.js';
import type { AuthService } from '../modules/auth/auth.service.js';

describe('EventsGateway', () => {
  let gateway: EventsGateway;
  let authService: {
    verifyToken: ReturnType<typeof vi.fn>;
  };
  let mockServer: {
    use: ReturnType<typeof vi.fn>;
    to: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    authService = {
      verifyToken: vi.fn(),
    };
    gateway = new EventsGateway(authService as unknown as AuthService);
    mockServer = {
      use: vi.fn(),
      to: vi.fn().mockReturnValue({
        emit: vi.fn().mockReturnValue(true),
      }),
    };
    gateway.server = mockServer as unknown as Server;
  });

  describe('extractHandshakeToken', () => {
    it('extracts token from canonical handshake.auth.token', () => {
      const token = extractHandshakeToken({
        auth: { token: 'canonical-jwt-token' },
      });
      expect(token).toBe('canonical-jwt-token');
    });

    it('strips "Bearer " prefix from canonical handshake.auth.token', () => {
      const token = extractHandshakeToken({
        auth: { token: 'Bearer canonical-jwt-token' },
      });
      expect(token).toBe('canonical-jwt-token');
    });

    it('extracts token from compatibility handshake.headers.authorization', () => {
      const token = extractHandshakeToken({
        headers: { authorization: 'Bearer header-jwt-token' },
      });
      expect(token).toBe('header-jwt-token');
    });

    it('prefers canonical auth.token over headers.authorization', () => {
      const token = extractHandshakeToken({
        auth: { token: 'auth-token' },
        headers: { authorization: 'Bearer header-token' },
      });
      expect(token).toBe('auth-token');
    });

    it('returns null if neither is provided', () => {
      expect(extractHandshakeToken({})).toBeNull();
      expect(extractHandshakeToken({ auth: {} })).toBeNull();
      expect(extractHandshakeToken({ auth: { token: '   ' } })).toBeNull();
    });
  });

  describe('afterInit middleware', () => {
    let middleware: (socket: unknown, next: (err?: Error) => void) => Promise<void>;

    beforeEach(() => {
      gateway.afterInit(mockServer as unknown as Server);
      expect(mockServer.use).toHaveBeenCalledTimes(1);
      middleware = mockServer.use.mock.calls[0][0];
    });

    it('accepts valid authenticated socket and stores user in socket.data.user', async () => {
      const fakeUser = { id: 'user-123', jti: 'jti-1', exp: 9999999999 };
      authService.verifyToken.mockResolvedValue(fakeUser);

      const mockSocket = {
        id: 'sock-1',
        handshake: { auth: { token: 'valid.token' } },
        data: {},
      };
      const next = vi.fn();

      await middleware(mockSocket, next);

      expect(authService.verifyToken).toHaveBeenCalledWith('valid.token');
      expect(mockSocket.data).toEqual({ user: fakeUser });
      expect(next).toHaveBeenCalledWith();
    });

    it('rejects connection if token is missing', async () => {
      const mockSocket = {
        id: 'sock-2',
        handshake: { auth: {} },
        data: {},
      };
      const next = vi.fn();

      await middleware(mockSocket, next);

      expect(authService.verifyToken).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Missing authentication token'),
        }),
      );
    });

    it('rejects connection if token is invalid or expired', async () => {
      authService.verifyToken.mockRejectedValue(
        new UnauthorizedException('Token has expired'),
      );

      const mockSocket = {
        id: 'sock-3',
        handshake: { auth: { token: 'expired.token' } },
        data: {},
      };
      const next = vi.fn();

      await middleware(mockSocket, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Token has expired'),
        }),
      );
    });

    it('rejects connection if token is revoked', async () => {
      authService.verifyToken.mockRejectedValue(
        new UnauthorizedException('Token has been revoked'),
      );

      const mockSocket = {
        id: 'sock-4',
        handshake: { auth: { token: 'revoked.token' } },
        data: {},
      };
      const next = vi.fn();

      await middleware(mockSocket, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Token has been revoked'),
        }),
      );
    });
  });

  describe('handleConnection', () => {
    it('joins authenticated socket to user:<id> room', () => {
      const mockSocket = {
        id: 'sock-conn-1',
        data: {
          user: { id: 'user-abc', jti: 'jti-1', exp: 12345 },
        },
        join: vi.fn(),
        disconnect: vi.fn(),
      };

      gateway.handleConnection(mockSocket as unknown as Socket);

      expect(mockSocket.join).toHaveBeenCalledWith('user:user-abc');
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });

    it('disconnects socket immediately if user is not in socket.data', () => {
      const mockSocket = {
        id: 'sock-conn-2',
        data: {},
        join: vi.fn(),
        disconnect: vi.fn(),
      };

      gateway.handleConnection(mockSocket as unknown as Socket);

      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('security: arbitrary room subscription prevention', () => {
    it('rejects client attempt to join arbitrary room', () => {
      const mockSocket = {
        id: 'sock-malicious',
        data: {
          user: { id: 'user-victim', jti: 'jti-1', exp: 12345 },
        },
        join: vi.fn(),
      };

      const result = gateway.handleJoin(mockSocket as unknown as Socket, {
        room: 'user:someone-else',
      });

      expect(result).toEqual({
        status: 'error',
        message: 'Client-initiated room subscriptions are forbidden',
      });
      expect(mockSocket.join).not.toHaveBeenCalled();
    });
  });

  describe('emitToUser', () => {
    it('emits payload to user:<userId> room', () => {
      const emitMock = vi.fn().mockReturnValue(true);
      mockServer.to.mockReturnValue({ emit: emitMock });

      const success = gateway.emitToUser('target-user-7', 'test:event', { hello: 'world' });

      expect(mockServer.to).toHaveBeenCalledWith('user:target-user-7');
      expect(emitMock).toHaveBeenCalledWith('test:event', { hello: 'world' });
      expect(success).toBe(true);
    });
  });
});
