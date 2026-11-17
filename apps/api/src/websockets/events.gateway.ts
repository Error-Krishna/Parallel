import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../modules/auth/auth.service.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';

export interface AuthenticatedSocket extends Socket {
  data: {
    user: AuthenticatedUser;
    [key: string]: unknown;
  };
}

/**
 * Extracts authentication token from Socket.IO handshake.
 *
 * Canonical format: handshake.auth.token
 * Compatibility format: handshake.headers.authorization ('Bearer <token>')
 */
export function extractHandshakeToken(handshake: {
  auth?: Record<string, unknown>;
  headers?: Record<string, unknown>;
}): string | null {
  // 1. Canonical: socket.handshake.auth.token
  const authToken = handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim().length > 0) {
    const trimmed = authToken.trim();
    return trimmed.startsWith('Bearer ') ? trimmed.slice(7).trim() : trimmed;
  }

  // 2. Compatibility: HTTP Authorization header
  const header =
    handshake.headers?.authorization ?? handshake.headers?.Authorization;
  if (typeof header === 'string' && header.trim().length > 0) {
    const trimmed = header.trim();
    return trimmed.startsWith('Bearer ') ? trimmed.slice(7).trim() : trimmed;
  }

  return null;
}

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(private readonly authService: AuthService) {}

  afterInit(server: Server) {
    server.use(async (socket, next) => {
      try {
        const token = extractHandshakeToken(socket.handshake);
        if (!token) {
          return next(new Error('Unauthorized: Missing authentication token'));
        }

        const user = await this.authService.verifyToken(token);
        socket.data.user = user;
        return next();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Invalid token';
        // Security constraint: never log access tokens or raw JWT signatures
        this.logger.warn(`WebSocket handshake rejected: ${message}`);
        return next(new Error(`Unauthorized: ${message}`));
      }
    });

    this.logger.log('EventsGateway initialized with handshake authentication');
  }

  handleConnection(client: Socket) {
    const user = client.data.user as AuthenticatedUser | undefined;

    if (!user?.id) {
      this.logger.warn(
        `Socket ${client.id} connected without authenticated identity; terminating`,
      );
      client.disconnect(true);
      return;
    }

    // Automatically join the authenticated socket to their private user room
    const userRoom = `user:${user.id}`;
    client.join(userRoom);
    this.logger.log(
      `Socket ${client.id} authenticated as user ${user.id} and joined room ${userRoom}`,
    );
  }

  handleDisconnect(client: Socket) {
    const user = client.data.user as AuthenticatedUser | undefined;
    this.logger.log(
      `Socket ${client.id} disconnected (user: ${user?.id ?? 'anonymous'})`,
    );
  }

  /**
   * Security invariant: Clients cannot arbitrarily join user or system rooms.
   * Personal room assignment is strictly server-managed during handshake.
   */
  @SubscribeMessage('join')
  handleJoin(client: Socket, _payload: unknown) {
    const user = client.data.user as AuthenticatedUser | undefined;
    this.logger.warn(
      `Rejected client attempt to join room from socket ${client.id} (user: ${user?.id ?? 'unknown'})`,
    );
    return {
      status: 'error',
      message: 'Client-initiated room subscriptions are forbidden',
    };
  }

  /**
   * Helper to emit a message to an authenticated user's private room.
   */
  emitToUser<T>(userId: string, event: string, payload: T): boolean {
    if (!this.server) {
      return false;
    }
    return this.server.to(`user:${userId}`).emit(event, payload);
  }
}
