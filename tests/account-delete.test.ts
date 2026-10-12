import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { pool } from '../src/db';
import { buildApp, registerUser, createRankie, bearer } from './helpers';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
afterAll(async () => { await app.close(); await pool.end(); });

// App Store 5.1.1(v) / Google Play: người dùng xoá được tài khoản NGAY trong app — kể cả khi đã có
// bài, phiếu, bình luận, tin nhắn (mọi bảng tham chiếu user phải xoá dây chuyền, không được chặn).
describe('xoá tài khoản', () => {
  it('xoá được tài khoản có bài, phiếu, bình luận, tin nhắn; dữ liệu người khác vẫn chạy', async () => {
    const owner = await registerUser(app);
    const fan = await registerUser(app);
    const rk = await createRankie(app, owner.accessToken);
    const fanRk = await createRankie(app, fan.accessToken);

    // fan vote + bình luận bài owner; owner vote + bình luận bài fan; 2 người nhắn tin
    await app.inject({ method: 'POST', url: `/rankies/${rk.id}/vote`, headers: bearer(fan.accessToken), payload: { optionIds: [rk.options[0].id] } });
    await app.inject({ method: 'POST', url: `/rankies/${fanRk.id}/vote`, headers: bearer(owner.accessToken), payload: { optionIds: [fanRk.options[1].id] } });
    await app.inject({ method: 'POST', url: `/posts/${rk.id}/comments`, headers: bearer(fan.accessToken), payload: { text: 'Hay quá' } });
    await app.inject({ method: 'POST', url: `/posts/${fanRk.id}/comments`, headers: bearer(owner.accessToken), payload: { text: `Chào @${fan.user.handle}` } });
    const conv = (await app.inject({ method: 'POST', url: '/conversations', headers: bearer(owner.accessToken), payload: { userId: fan.user.id } })).json();
    await app.inject({ method: 'POST', url: `/conversations/${conv.id}/messages`, headers: bearer(owner.accessToken), payload: { body: 'Xin chào' } });

    const del = await app.inject({ method: 'DELETE', url: '/users/me', headers: bearer(owner.accessToken) });
    expect(del.statusCode).toBe(204);

    // không đăng nhập lại được, token cũ hết tác dụng, bài biến mất
    const me = await app.inject({ method: 'GET', url: '/users/me', headers: bearer(owner.accessToken) });
    expect([401, 404]).toContain(me.statusCode);
    expect((await app.inject({ method: 'GET', url: `/posts/${rk.id}`, headers: bearer(fan.accessToken) })).statusCode).toBe(404);

    // người còn lại: feed, hộp thư, thông báo, bài của mình (phiếu của owner đã bị gỡ) vẫn chạy
    expect((await app.inject({ method: 'GET', url: '/feed', headers: bearer(fan.accessToken) })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/conversations', headers: bearer(fan.accessToken) })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/notifications', headers: bearer(fan.accessToken) })).statusCode).toBe(200);
    const res = await app.inject({ method: 'GET', url: `/rankies/${fanRk.id}/results` });
    expect(res.statusCode).toBe(200);
    // phiếu của người đã xoá tài khoản KHÔNG còn tính trong kết quả
    expect(res.json().totalVotes).toBe(0);
  });
});
