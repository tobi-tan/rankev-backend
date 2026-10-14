import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { pool, db } from '../src/db';
import { passwordResets, posts, series, seriesPosts, users } from '../src/db/schema';
import { buildApp, registerUser, bearer } from './helpers';
import { ensureClassics, CLASSICS_SERIES } from '../src/modules/classics/classics';
import { outbox } from '../src/lib/mailer';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
afterAll(async () => { await app.close(); await pool.end(); });

describe('nội dung kinh điển của @rankev', () => {
  it('tạo series đối đầu + path/survey/exam; chạy lại không tạo trùng; người dùng bình chọn được', async () => {
    await db.update(users).set({ passwordHash: null }).where(eq(users.handle, 'rankev'));
    await ensureClassics();
    expect(await ensureClassics()).toBe(0); // idempotent

    const [official] = await db.select().from(users).where(eq(users.handle, 'rankev'));
    expect(official.verified).toBe(true);
    expect(official.passwordHash).toBeNull(); // không ai đăng nhập được
    const [ser] = await db.select().from(series).where(eq(series.name, CLASSICS_SERIES));
    const chapters = await db.select().from(seriesPosts).where(eq(seriesPosts.seriesId, ser.id));
    expect(chapters.length).toBe(16);
    const mine = await db.select({ type: posts.type, deckMode: posts.deckMode }).from(posts).where(eq(posts.authorId, official.id));
    expect(mine.filter((p) => p.type === 'path').length).toBe(1);
    expect(mine.filter((p) => p.deckMode === 'exam').length).toBe(1);
    expect(mine.filter((p) => p.deckMode === 'survey').length).toBe(1);

    // người dùng thật bình chọn trận đầu tiên — không có phiếu giả từ trước
    const u = await registerUser(app);
    const [pho] = await db.select().from(posts).where(eq(posts.title, 'Phở hay Bún chả?'));
    const rk = (await app.inject({ method: 'GET', url: `/posts/${pho.id}`, headers: bearer(u.accessToken) })).json();
    const before = rk.options.reduce((s: number, o: { votes: number }) => s + o.votes, 0);
    const v = await app.inject({ method: 'POST', url: `/rankies/${pho.id}/vote`, headers: bearer(u.accessToken), payload: { optionIds: [rk.options[0].id] } });
    expect(v.statusCode).toBe(200);
    expect(v.json().options.reduce((s: number, o: { votes: number }) => s + o.votes, 0)).toBe(before + 1);

    // không ai đăng ký được handle "rankev"
    const reg = await app.inject({ method: 'POST', url: '/auth/register', payload: { email: `x${Date.now()}@t.local`, password: 'supersecret', handle: 'Rankev', name: 'Giả mạo' } });
    expect(reg.statusCode).toBe(409);
  });

  it('gắn OFFICIAL_EMAIL → quên mật khẩu → đăng nhập được vào @rankev để tự đăng bài', async () => {
    const email = `brand_${Date.now()}@test.local`;
    process.env.OFFICIAL_EMAIL = email;
    await ensureClassics();
    delete process.env.OFFICIAL_EMAIL;
    // DB test dùng chung giữa các lần chạy: xoá lịch sử mã cũ (giới hạn 3 mã/giờ/tài khoản)
    const [off] = await db.select({ id: users.id }).from(users).where(eq(users.handle, 'rankev'));
    await db.delete(passwordResets).where(eq(passwordResets.userId, off.id));
    expect((await app.inject({ method: 'POST', url: '/auth/forgot', payload: { email } })).statusCode).toBe(204);
    const mail = [...outbox].reverse().find((m) => m.to === email && m.subject.includes('đặt lại mật khẩu'));
    const code = (mail!.text.match(/\b(\d{6})\b/) || [])[1];
    expect((await app.inject({ method: 'POST', url: '/auth/reset', payload: { email, code, password: 'MatKhauRankev1' } })).statusCode).toBe(204);
    const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'MatKhauRankev1' } });
    expect(login.statusCode).toBe(200);
    expect(login.json().user.handle).toBe('rankev');
    // dọn dẹp: trả @rankev về trạng thái không mật khẩu (DB test dùng chung giữa các lần chạy)
    await db.update(users).set({ passwordHash: null, email: 'official@rankev.local' }).where(eq(users.handle, 'rankev'));
  });
});
