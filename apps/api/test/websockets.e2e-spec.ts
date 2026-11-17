import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { io, type Socket as ClientSocket } from 'socket.io-client';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { JwtService } from '@nestjs/jwt';
import { Redis } from 'ioredis';
import { createTestApp, getHttpServer } from './utils/create-test-app.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { REDIS_CLIENT } from '../src/jobs/redis.provider.js';
import { EventsGateway } from '../src/websockets/events.gateway.js';

describe('WebSockets EventsGateway (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let authService: AuthService;
  let jwtService: JwtService;
  let redis: Redis;
  let gateway: EventsGateway;
  let baseUrl: string;

  const createdUserIds: string[] = [];
  const openSockets: ClientSocket[] = [];

  function trackSocket(socket: ClientSocket): ClientSocket {
    openSockets.push(socket);
    return socket;
  }

  beforeAll(async () => {
    // Exercises the real application bootstrap: Fastify adapter, AppModule, Redis, and Postgres
    app = await createTestApp();
    prisma = app.get(PrismaService);
    authService = app.get(AuthService);
    jwtService = app.get(JwtService);
    redis = app.get(REDIS_CLIENT);
    gateway = app.get(EventsGateway);

    // Listen on an ephemeral port assigned by the OS
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    for (const socket of openSockets) {
      if (socket.connected) {
        socket.disconnect();
      }
    }

    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }

    await app.close();
  });

  async function createTestUser() {
    const suffix = randomUUID().slice(0, 8);
    const signupResult = await authService.signup({
      email: `ws-${suffix}@example.com`,
      username: `ws_${suffix}`,
      password: 'password123',
    });
    createdUserIds.push(signupResult.user.id);
    return signupResult;
  }

  function waitForEvent<T = unknown>(socket: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for event "${event}" after ${timeoutMs}ms`));
      }, timeoutMs);

      socket.once(event, (data: T) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  function connectClient(options: {
    token?: string | null;
    useHeader?: boolean;
    timeoutMs?: number;
  }): { socket: ClientSocket; connectPromise: Promise<void> } {
    const { token, useHeader = false, timeoutMs = 3000 } = options;

    const socketOptions: Parameters<typeof io>[1] = {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      timeout: timeoutMs,
    };

    if (token) {
      if (useHeader) {
        socketOptions.extraHeaders = {
          authorization: `Bearer ${token}`,
        };
      } else {
        socketOptions.auth = {
          token,
        };
      }
    }

    const socket = trackSocket(io(baseUrl, socketOptions));

    const connectPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Socket connection timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      socket.on('connect', () => {
        clearTimeout(timer);
        resolve();
      });

      socket.on('connect_error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    return { socket, connectPromise };
  }

  it('connects successfully with a valid token in handshake.auth.token (canonical)', async () => {
    const { accessToken } = await createTestUser();
    const { socket, connectPromise } = connectClient({ token: accessToken });

    await expect(connectPromise).resolves.toBeUndefined();
    expect(socket.connected).toBe(true);
    socket.disconnect();
  });

  it('connects successfully with compatibility Authorization header', async () => {
    const { accessToken } = await createTestUser();
    const { socket, connectPromise } = connectClient({
      token: accessToken,
      useHeader: true,
    });

    await expect(connectPromise).resolves.toBeUndefined();
    expect(socket.connected).toBe(true);
    socket.disconnect();
  });

  it('rejects connection when token is missing', async () => {
    const { socket, connectPromise } = connectClient({ token: null });

    await expect(connectPromise).rejects.toThrow(/Missing authentication token/);
    expect(socket.connected).toBe(false);
  });

  it('rejects connection when token is malformed', async () => {
    const { socket, connectPromise } = connectClient({
      token: 'not-a-valid-jwt-token',
    });

    await expect(connectPromise).rejects.toThrow(/Invalid token/);
    expect(socket.connected).toBe(false);
  });

  it('rejects connection when token is expired', async () => {
    const { user } = await createTestUser();
    const expiredToken = jwtService.sign(
      { sub: user.id, jti: randomUUID() },
      { expiresIn: '-5s' },
    );

    const { socket, connectPromise } = connectClient({ token: expiredToken });

    await expect(connectPromise).rejects.toThrow(/Token has expired/);
    expect(socket.connected).toBe(false);
  });

  it('rejects connection when token is revoked in Redis', async () => {
    const { accessToken } = await createTestUser();

    // Verify token claims and revoke it via Redis key auth:revoked:<jti>
    const decoded = jwtService.decode(accessToken) as { jti: string; exp: number };
    await redis.set(`auth:revoked:${decoded.jti}`, '1', 'EX', 300);

    const { socket, connectPromise } = connectClient({ token: accessToken });

    await expect(connectPromise).rejects.toThrow(/Token has been revoked/);
    expect(socket.connected).toBe(false);

    // Clean up Redis key
    await redis.del(`auth:revoked:${decoded.jti}`);
  });

  it('automatically joins the authenticated socket to their private user:<id> room', async () => {
    const { user, accessToken } = await createTestUser();
    const { socket, connectPromise } = connectClient({ token: accessToken });

    await connectPromise;
    expect(socket.connected).toBe(true);

    const messagePromise = waitForEvent<{ text: string }>(socket, 'test:personal');

    // Server emits directly to user:<userId> room
    const emitted = gateway.emitToUser(user.id, 'test:personal', {
      text: 'hello from server room',
    });
    expect(emitted).toBe(true);

    const received = await messagePromise;
    expect(received).toEqual({ text: 'hello from server room' });
    socket.disconnect();
  });

  it('rejects client attempt to join arbitrary rooms and prevents cross-room snooping', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();

    const { socket: socketA, connectPromise: connectA } = connectClient({
      token: userA.accessToken,
    });
    const { socket: socketB, connectPromise: connectB } = connectClient({
      token: userB.accessToken,
    });

    await Promise.all([connectA, connectB]);

    // Client A attempts to join userB's private room
    const joinResponsePromise = new Promise<{ status: string; message: string }>((resolve) => {
      socketA.emit('join', { room: `user:${userB.user.id}` }, (response: { status: string; message: string }) => {
        resolve(response);
      });
    });

    // Alternatively listen for the returned ack/message
    const joinResult = await joinResponsePromise;
    expect(joinResult).toEqual({
      status: 'error',
      message: 'Client-initiated room subscriptions are forbidden',
    });

    // Verify User A does NOT receive messages targeted to User B's room
    let userAReceivedUserBMessage = false;
    socketA.on('secret:event', () => {
      userAReceivedUserBMessage = true;
    });

    const userBMessagePromise = waitForEvent<{ payload: string }>(socketB, 'secret:event');

    gateway.emitToUser(userB.user.id, 'secret:event', { payload: 'classified' });

    const receivedByB = await userBMessagePromise;
    expect(receivedByB).toEqual({ payload: 'classified' });

    // Wait 200ms to verify socketA never received socketB's message
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(userAReceivedUserBMessage).toBe(false);

    socketA.disconnect();
    socketB.disconnect();
  });

  it('verifies token parity with existing HTTP authentication behavior', async () => {
    const { accessToken } = await createTestUser();

    // 1. HTTP request with valid token works
    const httpRes = await request(getHttpServer(app))
      .get('/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(httpRes.status).toBe(200);

    // 2. WebSocket connection with same token works
    const { socket, connectPromise } = connectClient({ token: accessToken });
    await expect(connectPromise).resolves.toBeUndefined();
    expect(socket.connected).toBe(true);

    // 3. Revoke the token via Redis
    const decoded = jwtService.decode(accessToken) as { jti: string };
    await redis.set(`auth:revoked:${decoded.jti}`, '1', 'EX', 300);

    // 4. HTTP request is now rejected (401 Unauthorized)
    const revokedHttpRes = await request(getHttpServer(app))
      .get('/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(revokedHttpRes.status).toBe(401);

    // 5. New WebSocket connection with revoked token is rejected
    const { connectPromise: revokedConnectPromise } = connectClient({
      token: accessToken,
    });
    await expect(revokedConnectPromise).rejects.toThrow(/Token has been revoked/);

    // Clean up
    await redis.del(`auth:revoked:${decoded.jti}`);
    socket.disconnect();
  });
});
