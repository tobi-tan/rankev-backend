import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { pool } from '../src/db';
import { bearer, buildApp, createPath, createRankie, registerUser } from './helpers';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('comments', () => {
  it('creates, toggles rank, and soft-deletes', async () => {
    const { accessToken } = await registerUser(app);
    const rk = await createRankie(app, accessToken);

    const c = await app.inject({ method: 'POST', url: `/posts/${rk.id}/comments`, headers: bearer(accessToken), payload: { text: 'Hay!' } });
    expect(c.statusCode).toBe(201);
    const commentId = c.json().id;

    const up = await app.inject({ method: 'PATCH', url: `/comments/${commentId}/rank`, headers: bearer(accessToken), payload: { vote: 'up' } });
    expect(up.json()).toMatchObject({ rankUp: 1, myRank: 1 });
    const off = await app.inject({ method: 'PATCH', url: `/comments/${commentId}/rank`, headers: bearer(accessToken), payload: { vote: 'up' } });
    expect(off.json()).toMatchObject({ rankUp: 0, myRank: 0 });

    await app.inject({ method: 'DELETE', url: `/comments/${commentId}`, headers: bearer(accessToken) });
    const list = await app.inject({ method: 'GET', url: `/posts/${rk.id}/comments`, headers: bearer(accessToken) });
    const found = list.json().items.find((x: any) => x.id === commentId);
    expect(found.deleted).toBe(true);
    expect(found.text).toBeNull();
  });

  it('enforces per-ending comment lock', async () => {
    const author = await registerUser(app);
    const path = await createPath(app, author.accessToken);
    // author reaches Kết A and comments supporting it
    await app.inject({ method: 'POST', url: `/paths/${path.id}/complete`, headers: bearer(author.accessToken), payload: { endingName: 'Kết A' } });
    await app.inject({ method: 'POST', url: `/posts/${path.id}/comments`, headers: bearer(author.accessToken), payload: { text: 'Bí mật Kết A', supports: ['Kết A'] } });

    // author (unlocked A) can view
    const okView = await app.inject({ method: 'GET', url: `/posts/${path.id}/comments?ending=${encodeURIComponent('Kết A')}`, headers: bearer(author.accessToken) });
    expect(okView.statusCode).toBe(200);
    expect(okView.json().items.length).toBe(1);

    // a fresh viewer who hasn't unlocked A → 403
    const viewer = await registerUser(app);
    const denied = await app.inject({ method: 'GET', url: `/posts/${path.id}/comments?ending=${encodeURIComponent('Kết A')}`, headers: bearer(viewer.accessToken) });
    expect(denied.statusCode).toBe(403);

    // unauthenticated → 403
    const anon = await app.inject({ method: 'GET', url: `/posts/${path.id}/comments?ending=${encodeURIComponent('Kết A')}` });
    expect(anon.statusCode).toBe(403);
  });
});

describe('bookmarks', () => {
  it('adds, lists, and removes', async () => {
    const { accessToken } = await registerUser(app);
    const rk = await createRankie(app, accessToken);

    expect((await app.inject({ method: 'POST', url: `/posts/${rk.id}/bookmark`, headers: bearer(accessToken) })).statusCode).toBe(204);
    const list = await app.inject({ method: 'GET', url: '/users/me/bookmarks', headers: bearer(accessToken) });
    expect(list.json().items.some((i: any) => i.id === rk.id)).toBe(true);

    expect((await app.inject({ method: 'DELETE', url: `/posts/${rk.id}/bookmark`, headers: bearer(accessToken) })).statusCode).toBe(204);
    const empty = await app.inject({ method: 'GET', url: '/users/me/bookmarks', headers: bearer(accessToken) });
    expect(empty.json().items.some((i: any) => i.id === rk.id)).toBe(false);
  });
});

describe('rankup', () => {
  it('sets, removes, and rejects self', async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);

    const set = await app.inject({ method: 'POST', url: `/users/${b.user.id}/rankup`, headers: bearer(a.accessToken), payload: { tier: 2 } });
    expect(set.json().tier).toBe(2);
    let me = await app.inject({ method: 'GET', url: '/users/me', headers: bearer(a.accessToken) });
    expect(me.json().rankUps[b.user.id]).toBe(2);

    await app.inject({ method: 'POST', url: `/users/${b.user.id}/rankup`, headers: bearer(a.accessToken), payload: { tier: 0 } });
    me = await app.inject({ method: 'GET', url: '/users/me', headers: bearer(a.accessToken) });
    expect(b.user.id in me.json().rankUps).toBe(false);

    const self = await app.inject({ method: 'POST', url: `/users/${a.user.id}/rankup`, headers: bearer(a.accessToken), payload: { tier: 1 } });
    expect(self.statusCode).toBe(400);
  });
});

describe('series + sessions', () => {
  it('manages a series lifecycle', async () => {
    const { accessToken } = await registerUser(app);
    const rk = await createRankie(app, accessToken);

    const s = await app.inject({ method: 'POST', url: '/series', headers: bearer(accessToken), payload: { name: 'Chương 1' } });
    const seriesId = s.json().id;
    await app.inject({ method: 'POST', url: `/series/${seriesId}/posts`, headers: bearer(accessToken), payload: { postId: rk.id } });

    let get = await app.inject({ method: 'GET', url: `/series/${seriesId}` });
    expect(get.json().posts.length).toBe(1);

    await app.inject({ method: 'PATCH', url: `/series/${seriesId}`, headers: bearer(accessToken), payload: { name: 'Đổi tên' } });
    await app.inject({ method: 'DELETE', url: `/series/${seriesId}/posts/${rk.id}`, headers: bearer(accessToken) });
    get = await app.inject({ method: 'GET', url: `/series/${seriesId}` });
    expect(get.json().name).toBe('Đổi tên');
    expect(get.json().posts.length).toBe(0);
  });

  it('records and lists presentation sessions', async () => {
    const { accessToken } = await registerUser(app);
    const rk = await createRankie(app, accessToken);
    const created = await app.inject({
      method: 'POST',
      url: `/posts/${rk.id}/sessions`,
      headers: bearer(accessToken),
      payload: { name: 'Buổi 1', participants: 10, totalVotes: 40 },
    });
    expect(created.statusCode).toBe(201);
    const mine = await app.inject({ method: 'GET', url: '/users/me/sessions', headers: bearer(accessToken) });
    expect(mine.json().items.some((x: any) => x.id === created.json().id)).toBe(true);
  });
});
