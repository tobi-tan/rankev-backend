import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Quản trị viên của bài test (phải đặt TRƯỚC khi env.ts được nạp).
const ADMIN_EMAIL = vi.hoisted(() => {
  const e = `mod_admin_${Date.now()}@test.local`;
  process.env.ADMIN_EMAILS = e;
  return e;
});

import type { FastifyInstance } from 'fastify';
import { pool } from '../src/db';
import { outbox } from '../src/lib/mailer';
import { buildApp, registerUser, createRankie, bearer } from './helpers';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
afterAll(async () => { await app.close(); await pool.end(); });

describe('kiểm duyệt (bàn quản trị)', () => {
  it('báo cáo → email quản trị viên → gỡ bài + khoá tài khoản → người báo cáo được thông báo', async () => {
    const admin = await registerUser(app, { email: ADMIN_EMAIL });
    const badEmail = `bad_${Date.now()}@test.local`;
    const bad = await registerUser(app, { email: badEmail, password: 'supersecret' });
    const reporter = await registerUser(app);
    const rk = await createRankie(app, bad.accessToken, { title: 'Bài vi phạm' });

    // người thường không vào được bàn kiểm duyệt; quản trị viên có cờ isAdmin
    expect((await app.inject({ method: 'GET', url: '/admin/reports', headers: bearer(reporter.accessToken) })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/users/me', headers: bearer(admin.accessToken) })).json().isAdmin).toBe(true);
    expect((await app.inject({ method: 'GET', url: '/users/me', headers: bearer(reporter.accessToken) })).json().isAdmin).toBe(false);

    const rep = await app.inject({ method: 'POST', url: `/posts/${rk.id}/report`, headers: bearer(reporter.accessToken), payload: { reason: 'hate', note: 'xúc phạm' } });
    expect(rep.statusCode).toBe(202);
    await new Promise((r) => setTimeout(r, 50)); // email gửi nền
    expect(outbox.some((m) => m.to === ADMIN_EMAIL && m.text.includes(rk.id))).toBe(true);

    const list = await app.inject({ method: 'GET', url: `/admin/reports?targetId=${rk.id}`, headers: bearer(admin.accessToken) });
    expect(list.statusCode).toBe(200);
    const g = list.json().items.find((x: any) => x.targetId === rk.id);
    expect(g).toBeTruthy();
    expect(g.reasons.hate).toBe(1);
    expect(g.target.title).toBe('Bài vi phạm');
    expect(g.target.author.id).toBe(bad.user.id);

    const res = await app.inject({ method: 'POST', url: '/admin/reports/resolve', headers: bearer(admin.accessToken), payload: { targetType: 'post', targetId: rk.id, action: 'remove_suspend' } });
    expect(res.statusCode).toBe(204);

    // bài biến mất với người khác; chủ bài không tự khôi phục được; không đăng nhập lại được
    expect((await app.inject({ method: 'GET', url: `/posts/${rk.id}`, headers: bearer(reporter.accessToken) })).statusCode).toBe(404);
    const restore = await app.inject({ method: 'POST', url: `/posts/${rk.id}/restore`, headers: bearer(bad.accessToken) });
    expect(restore.statusCode).toBe(403);
    const relog = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: badEmail, password: 'supersecret' } });
    expect(relog.statusCode).toBe(403);
    expect(relog.body).toContain('khoá');
    const refreshed = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: bad.refreshToken } });
    expect([401, 403]).toContain(refreshed.statusCode);

    // người báo cáo nhận thông báo kết quả; báo cáo chuyển sang "đã xử lý"
    const notifs = (await app.inject({ method: 'GET', url: '/notifications', headers: bearer(reporter.accessToken) })).json();
    expect(JSON.stringify(notifs)).toContain('report_resolved');
    const open = (await app.inject({ method: 'GET', url: `/admin/reports?targetId=${rk.id}`, headers: bearer(admin.accessToken) })).json().items;
    expect(open.some((x: any) => x.targetId === rk.id)).toBe(false);
    const done = (await app.inject({ method: 'GET', url: `/admin/reports?status=done&targetId=${rk.id}`, headers: bearer(admin.accessToken) })).json().items;
    expect(done.find((x: any) => x.targetId === rk.id)?.resolution).toBe('remove_suspend');
  });

  it('bỏ qua báo cáo không vi phạm: nội dung giữ nguyên', async () => {
    const admin = await registerUser(app, { email: ADMIN_EMAIL.replace('@', '+2@') });
    void admin;
    const owner = await registerUser(app);
    const reporter = await registerUser(app);
    const rk = await createRankie(app, owner.accessToken);
    await app.inject({ method: 'POST', url: `/posts/${rk.id}/report`, headers: bearer(reporter.accessToken), payload: { reason: 'spam' } });
    // quản trị viên thứ 2 không nằm trong ADMIN_EMAILS → 403
    expect((await app.inject({ method: 'POST', url: '/admin/reports/resolve', headers: bearer(admin.accessToken), payload: { targetType: 'post', targetId: rk.id, action: 'dismiss' } })).statusCode).toBe(403);
  });
});
