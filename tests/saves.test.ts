import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { pool } from '../src/db';
import { bearer, buildApp, registerUser } from './helpers';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
afterAll(async () => { await app.close(); await pool.end(); });

describe('saves (kho Đã lưu)', () => {
  it('lưu / bỏ lưu bài, user, comment vào một kho chung', async () => {
    const u = await registerUser(app);
    const tok = bearer(u.accessToken);

    // Lưu 3 loại.
    await app.inject({ method: 'POST', url: '/saves', headers: tok, payload: { refType: 'post', refId: 'p1', preview: { title: 'Bài A' } } });
    await app.inject({ method: 'POST', url: '/saves', headers: tok, payload: { refType: 'user', refId: 'u9', preview: { name: 'Ai đó' } } });
    const c = await app.inject({ method: 'POST', url: '/saves', headers: tok, payload: { refType: 'comment', refId: 'c5', preview: { text: 'hay' } } });
    expect(c.json()).toEqual({ saved: true });

    const list = await app.inject({ method: 'GET', url: '/saves', headers: tok });
    expect(list.statusCode).toBe(200);
    const items = list.json().items;
    expect(items.length).toBe(3);
    expect(items.map((i: any) => i.refType).sort()).toEqual(['comment', 'post', 'user']);
    expect(items.find((i: any) => i.refType === 'post').preview.title).toBe('Bài A');

    // Idempotent: lưu lại 'post' cập nhật preview, không nhân đôi.
    await app.inject({ method: 'POST', url: '/saves', headers: tok, payload: { refType: 'post', refId: 'p1', preview: { title: 'Bài A sửa' } } });
    const list2 = (await app.inject({ method: 'GET', url: '/saves', headers: tok })).json().items;
    expect(list2.length).toBe(3);
    expect(list2.find((i: any) => i.refType === 'post').preview.title).toBe('Bài A sửa');

    // Bỏ lưu comment.
    const del = await app.inject({ method: 'DELETE', url: '/saves/comment/c5', headers: tok });
    expect(del.json()).toEqual({ saved: false });
    const list3 = (await app.inject({ method: 'GET', url: '/saves', headers: tok })).json().items;
    expect(list3.length).toBe(2);
    expect(list3.some((i: any) => i.refType === 'comment')).toBe(false);
  });

  it('kho riêng theo từng người + cần đăng nhập', async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);
    await app.inject({ method: 'POST', url: '/saves', headers: bearer(a.accessToken), payload: { refType: 'post', refId: 'x1' } });
    const bList = (await app.inject({ method: 'GET', url: '/saves', headers: bearer(b.accessToken) })).json().items;
    expect(bList.length).toBe(0);
    const noAuth = await app.inject({ method: 'GET', url: '/saves' });
    expect(noAuth.statusCode).toBe(401);
  });
});
