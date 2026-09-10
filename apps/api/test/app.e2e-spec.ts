import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { createTestApp, getHttpServer } from './utils/create-test-app.js';

describe('App (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1 returns the API status', async () => {
    const res = await request(getHttpServer(app)).get('/v1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: 'Parallel API', status: 'running' });
  });

  it('GET /v1/health reports database and redis as reachable', async () => {
    const res = await request(getHttpServer(app)).get('/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.dependencies).toEqual({ database: 'ok', redis: 'ok' });
  });
});
