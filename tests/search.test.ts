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

describe('search', () => {
  it('tìm bài không phân biệt dấu + theo hashtag, tìm người dùng, tôn trọng chặn', async () => {
    const author = await registerUser(app);
    const viewer = await registerUser(app);
    const tag = `tk${Date.now()}`;
    const rk = await createRankie(app, author.accessToken, { title: `Phở hay bún chả ${tag}`, tags: [tag] });

    const byTitle = (await app.inject({ method: 'GET', url: `/search?q=${encodeURIComponent('pho hay bun')}` })).json();
    expect(byTitle.posts.some((p: any) => p.id === rk.id)).toBe(true);

    const byTag = (await app.inject({ method: 'GET', url: `/search?q=${encodeURIComponent('#' + tag)}` })).json();
    expect(byTag.posts.map((p: any) => p.id)).toEqual([rk.id]);

    const byUser = (await app.inject({ method: 'GET', url: `/search?q=${encodeURIComponent(author.user.handle)}` })).json();
    expect(byUser.users.some((u: any) => u.id === author.user.id)).toBe(true);

    await app.inject({ method: 'POST', url: `/users/${author.user.id}/block`, headers: bearer(viewer.accessToken), payload: {} });
    const blocked = (await app.inject({ method: 'GET', url: `/search?q=${tag}`, headers: bearer(viewer.accessToken) })).json();
    expect(blocked.posts).toEqual([]);
    expect(blocked.users).toEqual([]);

    const empty = (await app.inject({ method: 'GET', url: '/search?q=' })).json();
    expect(empty).toEqual({ posts: [], users: [], tournaments: [] });
  });
});
