import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { pool } from '../src/db';
import { buildApp, registerUser, createRankie, bearer } from './helpers';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
afterAll(async () => { await app.close(); await pool.end(); });

describe('profile theo handle + @nhắc tên', () => {
  it('GET /users/handle/:handle tra đúng user (không phân biệt hoa/thường, bỏ @)', async () => {
    const u = await registerUser(app);
    const r1 = await app.inject({ method: 'GET', url: `/users/handle/${u.user.handle}` });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().user.id).toBe(u.user.id);
    // có @ đầu + đổi hoa thường vẫn ra đúng
    const r2 = await app.inject({ method: 'GET', url: `/users/handle/@${u.user.handle.toUpperCase()}` });
    expect(r2.statusCode).toBe(200);
    expect(r2.json().user.id).toBe(u.user.id);
    // handle không tồn tại → 404
    const r3 = await app.inject({ method: 'GET', url: '/users/handle/khong_ton_tai_zzz' });
    expect(r3.statusCode).toBe(404);
  });

  it('bình luận @nhắc tên tạo thông báo cho người được nhắc, không cho chính mình', async () => {
    const author = await registerUser(app);       // chủ bài + người bình luận
    const mentioned = await registerUser(app);     // người được nhắc
    const rk = await createRankie(app, author.accessToken);

    const res = await app.inject({
      method: 'POST',
      url: `/posts/${rk.id}/comments`,
      headers: bearer(author.accessToken),
      payload: { text: `Chào @${mentioned.user.handle} và @${author.user.handle} nhé!` },
    });
    expect(res.statusCode).toBe(201);

    // Người được nhắc có 1 thông báo mention
    const list = await app.inject({ method: 'GET', url: '/notifications', headers: bearer(mentioned.accessToken) });
    expect(list.statusCode).toBe(200);
    const items = list.json().items;
    expect(items.length).toBe(1);
    expect(items[0].type).toBe('mention');
    expect(items[0].actor.id).toBe(author.user.id);
    expect(items[0].postId).toBe(rk.id);
    expect(items[0].read).toBe(false);

    // Chưa đọc = 1
    const cnt = await app.inject({ method: 'GET', url: '/notifications/unread-count', headers: bearer(mentioned.accessToken) });
    expect(cnt.json().count).toBe(1);

    // Tác giả KHÔNG tự nhận thông báo dù có @chính mình
    const selfList = await app.inject({ method: 'GET', url: '/notifications', headers: bearer(author.accessToken) });
    expect(selfList.json().items.length).toBe(0);

    // Đánh dấu đã đọc toàn bộ → count về 0
    await app.inject({ method: 'POST', url: '/notifications/read', headers: bearer(mentioned.accessToken) });
    const cnt2 = await app.inject({ method: 'GET', url: '/notifications/unread-count', headers: bearer(mentioned.accessToken) });
    expect(cnt2.json().count).toBe(0);
  });
});

describe('thông báo bài mới', () => {
  it('báo cho người RankUp tầng Yêu thích/Fan cuồng; không báo tầng Quan tâm hay người đã ẩn', async () => {
    const author = await registerUser(app);
    const lover = await registerUser(app);   // tầng 2 → nhận
    const casual = await registerUser(app);  // tầng 1 → không nhận
    const muter = await registerUser(app);   // tầng 3 nhưng đã ẩn tác giả → không nhận
    await app.inject({ method: 'POST', url: `/users/${author.user.id}/rankup`, headers: bearer(lover.accessToken), payload: { tier: 2 } });
    await app.inject({ method: 'POST', url: `/users/${author.user.id}/rankup`, headers: bearer(casual.accessToken), payload: { tier: 1 } });
    await app.inject({ method: 'POST', url: `/users/${author.user.id}/rankup`, headers: bearer(muter.accessToken), payload: { tier: 3 } });
    await app.inject({ method: 'POST', url: `/users/${author.user.id}/mute`, headers: bearer(muter.accessToken) });

    const rk = await createRankie(app, author.accessToken);
    await new Promise((r) => setTimeout(r, 150)); // gửi thông báo chạy nền sau khi trả 201

    const got = (await app.inject({ method: 'GET', url: '/notifications', headers: bearer(lover.accessToken) })).json();
    const items = got.items ?? got;
    const np = items.find((n: { type: string }) => n.type === 'new_post');
    expect(np).toBeTruthy();
    expect(np.postId).toBe(rk.id);
    expect(np.targetType).toBe('rankie');
    expect(np.actor.id).toBe(author.user.id);

    for (const u of [casual, muter]) {
      const l = (await app.inject({ method: 'GET', url: '/notifications', headers: bearer(u.accessToken) })).json();
      expect((l.items ?? l).some((n: { type: string }) => n.type === 'new_post')).toBe(false);
    }
  });
});
