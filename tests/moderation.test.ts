import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { pool } from '../src/db';
import { bearer, buildApp, createRankie, registerUser } from './helpers';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await pool.end();
});

const inFeed = async (token: string, postId: string) => {
  const res = await app.inject({ method: 'GET', url: '/feed?limit=50', headers: bearer(token) });
  return res.json().items.some((i: any) => i.id === postId);
};

describe('moderation', () => {
  it('reports content idempotently', async () => {
    const author = await registerUser(app);
    const reporter = await registerUser(app);
    const rk = await createRankie(app, author.accessToken);

    const r1 = await app.inject({ method: 'POST', url: `/posts/${rk.id}/report`, headers: bearer(reporter.accessToken), payload: { reason: 'spam' } });
    expect(r1.statusCode).toBe(202);
    const r2 = await app.inject({ method: 'POST', url: `/posts/${rk.id}/report`, headers: bearer(reporter.accessToken), payload: { reason: 'spam' } });
    expect(r2.statusCode).toBe(202); // idempotent, no error
  });

  it('blocking an author hides their posts from the feed', async () => {
    const author = await registerUser(app);
    const viewer = await registerUser(app);
    const rk = await createRankie(app, author.accessToken, { title: 'BlockTest' });

    expect(await inFeed(viewer.accessToken, rk.id)).toBe(true);

    const block = await app.inject({ method: 'POST', url: `/users/${author.user.id}/block`, headers: bearer(viewer.accessToken), payload: {} });
    expect(block.statusCode).toBe(204);
    expect(await inFeed(viewer.accessToken, rk.id)).toBe(false);

    await app.inject({ method: 'DELETE', url: `/users/${author.user.id}/block`, headers: bearer(viewer.accessToken) });
    expect(await inFeed(viewer.accessToken, rk.id)).toBe(true);
  });

  it('rejects self-block', async () => {
    const u = await registerUser(app);
    const res = await app.inject({ method: 'POST', url: `/users/${u.user.id}/block`, headers: bearer(u.accessToken), payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('deletes the account and invalidates it', async () => {
    const u = await registerUser(app);
    const del = await app.inject({ method: 'DELETE', url: '/users/me', headers: bearer(u.accessToken) });
    expect(del.statusCode).toBe(204);
    // token still parses but the user is gone → /users/me 404
    const gone = await app.inject({ method: 'GET', url: '/users/me', headers: bearer(u.accessToken) });
    expect(gone.statusCode).toBe(404);
  });

  it('serves legal pages', async () => {
    const p = await app.inject({ method: 'GET', url: '/legal/privacy' });
    expect(p.statusCode).toBe(200);
    expect(p.headers['content-type']).toContain('text/html');
    const t = await app.inject({ method: 'GET', url: '/legal/terms' });
    expect(t.statusCode).toBe(200);
  });
});
