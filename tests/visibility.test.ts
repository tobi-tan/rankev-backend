import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { pool } from '../src/db';
import { buildApp, registerUser, createRankie, bearer } from './helpers';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
afterAll(async () => { await app.close(); await pool.end(); });

const get = (url: string, token?: string) => app.inject({ method: 'GET', url, headers: token ? bearer(token) : {} });

describe('quyền xem bài (riêng tư / ẩn / xoá / chặn)', () => {
  it('bài "chỉ mình tôi": chủ thấy, người khác 404 + không có trong feed/hồ sơ/tìm kiếm + không vote được', async () => {
    const owner = await registerUser(app);
    const other = await registerUser(app);
    const rk = await createRankie(app, owner.accessToken, { title: 'Bai rieng tu zqx' });
    const p = await app.inject({ method: 'PATCH', url: `/posts/${rk.id}`, headers: bearer(owner.accessToken), payload: { visibility: 'private' } });
    expect(p.statusCode).toBe(200);

    expect((await get(`/posts/${rk.id}`, owner.accessToken)).statusCode).toBe(200);
    expect((await get(`/posts/${rk.id}`, other.accessToken)).statusCode).toBe(404);
    expect((await get(`/posts/${rk.id}`)).statusCode).toBe(404);
    const feed = (await get('/feed?limit=50', other.accessToken)).json();
    expect(feed.items.some((x: { id: string }) => x.id === rk.id)).toBe(false);
    const prof = (await get(`/users/${owner.user.id}/posts`, other.accessToken)).json();
    expect(prof.items.some((x: { id: string }) => x.id === rk.id)).toBe(false);
    const s = (await get('/search?q=zqx', other.accessToken)).json();
    expect(s.posts.some((x: { id: string }) => x.id === rk.id)).toBe(false);
    const v = await app.inject({ method: 'POST', url: `/rankies/${rk.id}/vote`, headers: bearer(other.accessToken), payload: { optionIds: [rk.options[0].id] } });
    expect(v.statusCode).toBe(404);
    // chủ vẫn thấy trong /users/me/posts kèm cờ visibility
    const mine = (await get('/users/me/posts', owner.accessToken)).json();
    expect(mine.items.find((x: { id: string }) => x.id === rk.id)?.visibility).toBe('private');
  });

  it('"theo link": không lên feed/hồ sơ nhưng mở được bằng link; ghim lên đầu hồ sơ', async () => {
    const owner = await registerUser(app);
    const other = await registerUser(app);
    const a = await createRankie(app, owner.accessToken, { title: 'A' });
    const b = await createRankie(app, owner.accessToken, { title: 'B' });
    await app.inject({ method: 'PATCH', url: `/posts/${b.id}`, headers: bearer(owner.accessToken), payload: { visibility: 'unlisted' } });
    expect((await get(`/posts/${b.id}`, other.accessToken)).statusCode).toBe(200);
    const prof = (await get(`/users/${owner.user.id}/posts`, other.accessToken)).json();
    expect(prof.items.map((x: { id: string }) => x.id)).toEqual([a.id]);
    // ghim bài cũ hơn → lên đầu
    const c = await createRankie(app, owner.accessToken, { title: 'C' });
    await app.inject({ method: 'PATCH', url: `/posts/${a.id}`, headers: bearer(owner.accessToken), payload: { pinned: true } });
    const prof2 = (await get(`/users/${owner.user.id}/posts`, other.accessToken)).json();
    expect(prof2.items[0].id).toBe(a.id);
    expect(prof2.items[0].pinned).toBe(true);
    expect(prof2.items.map((x: { id: string }) => x.id)).toContain(c.id);
  });

  it('bài đã xoá: người khác 404, không vote/bình luận được', async () => {
    const owner = await registerUser(app);
    const other = await registerUser(app);
    const rk = await createRankie(app, owner.accessToken);
    await app.inject({ method: 'DELETE', url: `/posts/${rk.id}`, headers: bearer(owner.accessToken) });
    expect((await get(`/posts/${rk.id}`, other.accessToken)).statusCode).toBe(404);
    const v = await app.inject({ method: 'POST', url: `/rankies/${rk.id}/vote`, headers: bearer(other.accessToken), payload: { optionIds: [rk.options[0].id] } });
    expect(v.statusCode).toBe(404);
    const c = await app.inject({ method: 'POST', url: `/posts/${rk.id}/comments`, headers: bearer(other.accessToken), payload: { text: 'hi' } });
    expect(c.statusCode).toBe(404);
  });

  it('bị chặn: không xem hồ sơ, không bình luận bài của người chặn mình', async () => {
    const owner = await registerUser(app);
    const troll = await registerUser(app);
    const rk = await createRankie(app, owner.accessToken);
    await app.inject({ method: 'POST', url: `/users/${troll.user.id}/block`, headers: bearer(owner.accessToken), payload: {} });
    expect((await get(`/users/${owner.user.id}/posts`, troll.accessToken)).json().items).toEqual([]);
    const c = await app.inject({ method: 'POST', url: `/posts/${rk.id}/comments`, headers: bearer(troll.accessToken), payload: { text: 'spam' } });
    expect(c.statusCode).toBe(404);
  });

  it('@nhắc tên trong mô tả bài tạo thông báo', async () => {
    const owner = await registerUser(app);
    const friend = await registerUser(app);
    // friend là fan Yêu thích → lẽ ra nhận "bài mới", nhưng đã được @nhắc thì chỉ 1 thông báo.
    await app.inject({ method: 'POST', url: `/users/${owner.user.id}/rankup`, headers: bearer(friend.accessToken), payload: { tier: 2 } });
    await createRankie(app, owner.accessToken, { caption: `Vào vote nhé @${friend.user.handle}` });
    await new Promise((r) => setTimeout(r, 150));
    const n = (await get('/notifications', friend.accessToken)).json();
    expect(n.items.some((x: { type: string; commentId: string | null }) => x.type === 'mention' && x.commentId === null)).toBe(true);
    expect(n.items.some((x: { type: string }) => x.type === 'new_post')).toBe(false);
  });
});

describe('hashtag + quyền riêng tư lúc đăng', () => {
  it('#hashtag trong mô tả thành tag; Path/Survey cũng lưu tag; tạo bài "chỉ mình tôi" ngay từ đầu', async () => {
    const u = await registerUser(app);
    const other = await registerUser(app);
    const rk = await createRankie(app, u.accessToken, { caption: 'Chọn đi #caphe #SàiGòn nhé', tags: ['nhanh'] });
    expect(rk.tags).toEqual(['nhanh', 'caphe', 'SàiGòn']);
    const path = (await app.inject({ method: 'POST', url: '/posts', headers: bearer(u.accessToken), payload: {
      type: 'path', title: 'P', caption: 'thử #duLich', tags: ['vui'],
      questions: [{ key: 'q1', text: '?', isEntry: true, answers: [{ label: 'a', targetType: 'ending', targetKey: 'E1' }, { label: 'b', targetType: 'ending', targetKey: 'E2' }] }],
      endings: [{ name: 'E1' }, { name: 'E2' }],
    } })).json();
    const mine = (await app.inject({ method: 'GET', url: '/users/me/posts', headers: bearer(u.accessToken) })).json();
    expect(mine.items.find((x: { id: string }) => x.id === path.id)?.tags).toEqual(['vui', 'duLich']);
    const priv = await createRankie(app, u.accessToken, { title: 'Riêng tư từ đầu', visibility: 'private' });
    expect((await app.inject({ method: 'GET', url: `/posts/${priv.id}`, headers: bearer(other.accessToken) })).statusCode).toBe(404);
    // sửa mô tả → tag cập nhật theo
    const ed = (await app.inject({ method: 'PATCH', url: `/posts/${rk.id}`, headers: bearer(u.accessToken), payload: { caption: 'đổi #trasua' } })).json();
    expect(ed.tags).toEqual(['nhanh', 'trasua']);
  });
});
