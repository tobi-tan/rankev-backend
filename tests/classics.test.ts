import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq, inArray } from 'drizzle-orm';
import { pool, db } from '../src/db';
import { deckOptions, deckQuestions, passwordResets, pathEndings, pathQuestions, posts, rankieOptions, series, seriesPosts, users } from '../src/db/schema';
import { buildApp, registerUser, bearer } from './helpers';
import { ensureClassics, LEGACY_CLASSICS_SERIES, RETIRED_MATCHUPS } from '../src/modules/classics/classics';
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
    // không gom series: mỗi trận là một bài riêng, gắn #kinhdien
    expect((await db.select().from(series).where(eq(series.name, LEGACY_CLASSICS_SERIES))).length).toBe(0);
    const mine = (await db.select({ type: posts.type, deckMode: posts.deckMode, chartType: posts.chartType, tags: posts.tags, id: posts.id, deletedAt: posts.deletedAt }).from(posts).where(eq(posts.authorId, official.id))).filter((p) => !p.deletedAt);
    const duels = mine.filter((p) => p.chartType === 'head_to_head' && Array.isArray(p.tags) && (p.tags as string[]).includes('kinhdien'));
    expect(duels.length).toBeGreaterThanOrEqual(12);
    // 4 trận đã bỏ không còn hiển thị (xoá mềm)
    const retired = await db.select({ deletedAt: posts.deletedAt }).from(posts).where(and(eq(posts.authorId, official.id), inArray(posts.title, RETIRED_MATCHUPS)));
    expect(retired.every((r) => r.deletedAt !== null)).toBe(true);
    const linked = await db.select().from(seriesPosts).where(inArray(seriesPosts.postId, duels.map((d) => d.id)));
    expect(linked.length).toBe(0);
    expect(mine.filter((p) => p.type === 'path').length).toBe(2);
    expect(mine.filter((p) => p.deckMode === 'exam').length).toBe(2);
    expect(mine.filter((p) => p.deckMode === 'survey').length).toBe(2);

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

  it('thẻ gợi ý /feed/classics: chỉ trận #kinhdien của @rankev chưa vote; vote xong thì biến mất', async () => {
    await ensureClassics();
    const u = await registerUser(app);
    const get = async () => (await app.inject({ method: 'GET', url: '/feed/classics?limit=30', headers: bearer(u.accessToken) })).json().items as { id: string; title: string; tags: string[]; author: { handle: string } }[];
    const before = await get();
    expect(before.length).toBeGreaterThanOrEqual(12);
    expect(before.every((x) => x.author.handle === 'rankev' && x.tags.includes('kinhdien'))).toBe(true);
    // người thường gắn #kinhdien không lọt vào gợi ý
    const fake = await app.inject({ method: 'POST', url: '/posts', headers: bearer(u.accessToken), payload: { type: 'rankie', title: 'Giả kinh điển', votingType: 'single', chartType: 'head_to_head', tags: ['kinhdien'], options: [{ label: 'A' }, { label: 'B' }] } });
    expect(fake.statusCode).toBe(201);
    expect((await get()).some((x) => x.title === 'Giả kinh điển')).toBe(false);
    // vote một trận → không còn trong gợi ý
    const target = before[0];
    const full = (await app.inject({ method: 'GET', url: `/posts/${target.id}`, headers: bearer(u.accessToken) })).json();
    await app.inject({ method: 'POST', url: `/rankies/${target.id}/vote`, headers: bearer(u.accessToken), payload: { optionIds: [full.options[0].id] } });
    expect((await get()).some((x) => x.id === target.id)).toBe(false);
  });

  it('ảnh thật (Unsplash không ghi nguồn, Wikimedia có ghi nguồn); ảnh chủ app tự đổi thì không bị ghi đè', async () => {
    await ensureClassics();
    const [pho] = await db.select().from(posts).where(eq(posts.title, 'Phở hay Bún chả?'));
    const opts = await db.select().from(rankieOptions).where(eq(rankieOptions.rankieId, pho.id));
    expect(opts.every((o) => (o.imageUrl || '').includes('images.unsplash.com'))).toBe(true);
    expect(pho.caption).not.toContain('📷 Ảnh:'); // Unsplash: không cần dòng ghi nguồn
    const [messi] = await db.select().from(posts).where(eq(posts.title, 'Messi hay Ronaldo?'));
    expect(messi.caption).toContain('Wikimedia Commons'); // ảnh CC vẫn ghi nguồn
    // chủ app tự đổi ảnh Phở → khởi động lại không ghi đè
    const mine = 'https://example.com/pho-cua-toi.jpg';
    await db.update(rankieOptions).set({ imageUrl: mine }).where(eq(rankieOptions.id, opts.find((o) => o.label === 'Phở')!.id));
    await ensureClassics();
    const after = await db.select().from(rankieOptions).where(eq(rankieOptions.rankieId, pho.id));
    expect(after.find((o) => o.label === 'Phở')!.imageUrl).toBe(mine);
    // trận nhân vật / thương hiệu giữ emoji
    const [tom] = await db.select().from(posts).where(eq(posts.title, 'Tom hay Jerry?'));
    const tomOpts = await db.select().from(rankieOptions).where(eq(rankieOptions.rankieId, tom.id));
    expect(tomOpts.every((o) => (o.imageUrl || '').includes('twemoji'))).toBe(true);
    // Path / Survey / Exam bản mới có ảnh; bản cũ chỉ có chữ đã gỡ
    const [official] = await db.select().from(users).where(eq(users.handle, 'rankev'));
    const specials = await db.select({ title: posts.title, media: posts.media, deletedAt: posts.deletedAt }).from(posts).where(and(eq(posts.authorId, official.id), inArray(posts.type, ['path', 'deck'])));
    for (const t of ['Nếu là một món ăn Việt, bạn sẽ là món gì?', 'Bạn có đang ngủ đủ giấc?', 'Nhìn ảnh, đoán địa danh Việt Nam']) {
      const p = specials.find((x) => x.title === t && !x.deletedAt);
      expect(p, t).toBeTruthy();
      expect(JSON.stringify(p!.media)).toContain('images.unsplash.com');
    }
    expect(specials.filter((x) => ['Bạn là món ăn Việt nào?', 'Giấc ngủ của bạn thế nào?', 'Bạn hiểu Việt Nam đến đâu?'].includes(x.title) && !x.deletedAt)).toHaveLength(0);
    // dọn: trả ảnh Phở về để lần chạy sau không lệch
    await db.update(rankieOptions).set({ imageUrl: null }).where(eq(rankieOptions.id, opts.find((o) => o.label === 'Phở')!.id));
  });

  it('nội dung mẫu: đề Toán 40 câu × 0,25 điểm (không bị làm tròn), truyện học đường 6 kết, WHO-5', async () => {
    await ensureClassics();
    const [official] = await db.select().from(users).where(eq(users.handle, 'rankev'));
    const mine = await db.select({ id: posts.id, title: posts.title, passingScore: posts.passingScore }).from(posts).where(eq(posts.authorId, official.id));
    const exam = mine.find((p) => p.title === 'Đề thi thử THPT môn Toán — 40 câu')!;
    expect(exam).toBeTruthy();
    const res = await app.inject({ method: 'GET', url: `/posts/${exam.id}` });
    const body = res.json();
    expect(body.questions).toHaveLength(40);
    expect(body.questions.every((q: { points: number }) => q.points === 0.25)).toBe(true);
    // API công khai giấu đáp án (chống gian lận) → kiểm tra trong DB: mỗi câu đúng 1 đáp án đúng
    const qs = await db.select({ id: deckQuestions.id }).from(deckQuestions).where(eq(deckQuestions.postId, exam.id));
    const rights = await db.select({ q: deckOptions.questionId }).from(deckOptions).where(and(inArray(deckOptions.questionId, qs.map((q) => q.id)), eq(deckOptions.correct, true)));
    expect(rights).toHaveLength(40);
    expect(new Set(rights.map((r) => r.q)).size).toBe(40);
    expect(Number(exam.passingScore)).toBe(5);
    expect(mine.some((p) => p.title === 'Ngày đầu ở trường Sakuragaoka 🌸')).toBe(true);
    expect(mine.some((p) => p.title === 'Chỉ số hạnh phúc WHO-5: 2 tuần qua bạn thế nào?')).toBe(true);
  });

  it('đổi ảnh truyện mẫu (vd sang tranh anime) → bài đã tạo tự cập nhật ảnh hệ thống', async () => {
    await ensureClassics();
    const [official] = await db.select().from(users).where(eq(users.handle, 'rankev'));
    const [p] = await db.select({ id: posts.id }).from(posts).where(and(eq(posts.authorId, official.id), eq(posts.title, 'Ngày đầu ở trường Sakuragaoka 🌸')));
    const [q] = await db.select().from(pathQuestions).where(and(eq(pathQuestions.postId, p.id), eq(pathQuestions.isEntry, true)));
    const [e] = await db.select().from(pathEndings).where(eq(pathEndings.postId, p.id)).limit(1);
    const oldScene = q.sceneImageUrl, oldEnd = e.imageUrl;
    // giả lập ảnh cũ trong DB khác bản định nghĩa → chạy lại phải đồng bộ về bản định nghĩa
    await db.update(pathQuestions).set({ sceneImageUrl: 'https://images.unsplash.com/photo-old?w=1080' }).where(eq(pathQuestions.id, q.id));
    await db.update(pathEndings).set({ imageUrl: null }).where(eq(pathEndings.id, e.id));
    await ensureClassics();
    expect((await db.select().from(pathQuestions).where(eq(pathQuestions.id, q.id)))[0].sceneImageUrl).toBe(oldScene);
    expect((await db.select().from(pathEndings).where(eq(pathEndings.id, e.id)))[0].imageUrl).toBe(oldEnd);
    // ảnh người dùng tự đặt (không phải ảnh hệ thống) thì giữ nguyên
    await db.update(pathQuestions).set({ sceneImageUrl: 'https://res.cloudinary.com/x/image/upload/mine.jpg' }).where(eq(pathQuestions.id, q.id));
    await ensureClassics();
    expect((await db.select().from(pathQuestions).where(eq(pathQuestions.id, q.id)))[0].sceneImageUrl).toBe('https://res.cloudinary.com/x/image/upload/mine.jpg');
    await db.update(pathQuestions).set({ sceneImageUrl: oldScene }).where(eq(pathQuestions.id, q.id));
  });
});
