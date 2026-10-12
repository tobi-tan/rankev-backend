import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { pool } from '../src/db';
import { buildApp, registerUser, createRankie, bearer } from './helpers';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
afterAll(async () => { await app.close(); await pool.end(); });

describe('tải thông tin của bạn', () => {
  it('link tải ngắn hạn → file JSON có hồ sơ, bài, phiếu, bình luận; link không dùng làm token đăng nhập', async () => {
    const me = await registerUser(app);
    const other = await registerUser(app);
    const mine = await createRankie(app, me.accessToken, { title: 'Bài của tôi' });
    const theirs = await createRankie(app, other.accessToken, { options: [{ label: 'Phở' }, { label: 'Bún' }] });
    await app.inject({ method: 'POST', url: `/rankies/${theirs.id}/vote`, headers: bearer(me.accessToken), payload: { optionIds: [theirs.options[1].id] } });
    await app.inject({ method: 'POST', url: `/posts/${theirs.id}/comments`, headers: bearer(me.accessToken), payload: { text: 'Bún ngon hơn' } });

    expect((await app.inject({ method: 'POST', url: '/users/me/export-link' })).statusCode).toBe(401);
    const link = await app.inject({ method: 'POST', url: '/users/me/export-link', headers: bearer(me.accessToken) });
    expect(link.statusCode).toBe(200);
    const url: string = link.json().url;
    const token = decodeURIComponent(url.split('token=')[1]);

    const file = await app.inject({ method: 'GET', url });
    expect(file.statusCode).toBe(200);
    expect(file.headers['content-disposition']).toContain('attachment');
    const data = file.json();
    expect(data.profile.id).toBe(me.user.id);
    expect(data.profile.passwordHash).toBeUndefined();
    expect(data.posts.some((p: any) => p.id === mine.id)).toBe(true);
    expect(data.votes.find((v: any) => v.postId === theirs.id)?.choices).toEqual(['Bún']);
    expect(data.comments.some((c: any) => c.text === 'Bún ngon hơn')).toBe(true);

    // link tải KHÔNG phải token đăng nhập; token sai bị từ chối
    expect((await app.inject({ method: 'GET', url: '/users/me', headers: bearer(token) })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/users/me/export?token=abc' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: `/users/me/export?token=${encodeURIComponent(me.accessToken)}` })).statusCode).toBe(401);
  });
});
