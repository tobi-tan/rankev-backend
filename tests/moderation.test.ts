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

  it('"Không quan tâm" ẩn đúng 1 bài; "Ẩn bài của @x" ẩn mọi bài của họ; khôi phục được', async () => {
    const author = await registerUser(app);
    const viewer = await registerUser(app);
    const a = await createRankie(app, author.accessToken, { title: 'HideA' });
    const b = await createRankie(app, author.accessToken, { title: 'HideB' });
    const h = bearer(viewer.accessToken);

    expect((await app.inject({ method: 'POST', url: `/posts/${a.id}/hide`, headers: h, payload: {} })).statusCode).toBe(204);
    expect(await inFeed(viewer.accessToken, a.id)).toBe(false);
    expect(await inFeed(viewer.accessToken, b.id)).toBe(true);
    expect(await inFeed(author.accessToken, a.id)).toBe(true); // chỉ ẩn với người bấm

    expect((await app.inject({ method: 'POST', url: `/users/${author.user.id}/mute`, headers: h, payload: {} })).statusCode).toBe(204);
    expect(await inFeed(viewer.accessToken, b.id)).toBe(false);

    const m = (await app.inject({ method: 'GET', url: '/users/me/moderation', headers: h })).json();
    expect(m.hiddenPostIds).toEqual([a.id]);
    expect(m.muted.map((u: any) => u.id)).toEqual([author.user.id]);
    expect(m.blocked).toEqual([]);

    await app.inject({ method: 'DELETE', url: `/users/${author.user.id}/mute`, headers: h });
    await app.inject({ method: 'DELETE', url: '/users/me/hidden-posts', headers: h });
    expect(await inFeed(viewer.accessToken, a.id)).toBe(true);
    expect(await inFeed(viewer.accessToken, b.id)).toBe(true);
  });

  it('chặn là 2 chiều: người bị chặn cũng không thấy bài, và không ai nhắn tin được', async () => {
    const x = await registerUser(app);
    const y = await registerUser(app);
    const post = await createRankie(app, x.accessToken, { title: 'BlockBoth' });
    // Mở DM trước khi chặn
    const conv = (await app.inject({ method: 'POST', url: '/conversations', headers: bearer(y.accessToken), payload: { userId: x.user.id } })).json();

    await app.inject({ method: 'POST', url: `/users/${y.user.id}/block`, headers: bearer(x.accessToken), payload: {} });
    expect(await inFeed(y.accessToken, post.id)).toBe(false);

    const send = await app.inject({ method: 'POST', url: `/conversations/${conv.id}/messages`, headers: bearer(y.accessToken), payload: { body: 'hi' } });
    expect(send.statusCode).toBe(403);
    const reopen = await app.inject({ method: 'POST', url: '/conversations', headers: bearer(x.accessToken), payload: { userId: y.user.id } });
    expect(reopen.statusCode).toBe(403);
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
