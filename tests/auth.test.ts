import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { pool } from '../src/db';
import { bearer, buildApp, registerUser, uniqHandle } from './helpers';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('auth', () => {
  it('registers a new user and returns tokens', async () => {
    const { user, accessToken, refreshToken } = await registerUser(app);
    expect(user.id).toBeTruthy();
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
  });

  it('rejects duplicate email with 409', async () => {
    const handle = uniqHandle();
    const email = `${handle}@test.local`;
    await registerUser(app, { handle, email });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: 'supersecret', handle: uniqHandle(), name: 'Dup' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('rejects invalid registration input with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'not-an-email', password: 'x', handle: '!!', name: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('logs in with correct credentials', async () => {
    const handle = uniqHandle();
    const email = `${handle}@test.local`;
    await registerUser(app, { handle, email, password: 'supersecret' });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'supersecret' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toBeTruthy();
  });

  it('rejects wrong password with 401', async () => {
    const handle = uniqHandle();
    const email = `${handle}@test.local`;
    await registerUser(app, { handle, email, password: 'supersecret' });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'wrongpass' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /users/me requires auth and returns the user', async () => {
    const { accessToken, user } = await registerUser(app);
    const noAuth = await app.inject({ method: 'GET', url: '/users/me' });
    expect(noAuth.statusCode).toBe(401);

    const ok = await app.inject({ method: 'GET', url: '/users/me', headers: bearer(accessToken) });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().user.id).toBe(user.id);
  });

  it('refreshes tokens with a valid refresh token', async () => {
    const { refreshToken } = await registerUser(app);
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toBeTruthy();
    // old refresh token is rotated → reuse fails
    const reuse = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken } });
    expect(reuse.statusCode).toBe(401);
  });
});
