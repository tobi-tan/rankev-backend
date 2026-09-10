import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { pool, db } from '../src/db';
import { users } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { buildApp, registerUser } from './helpers';
import { socialLogin } from '../src/modules/auth/auth.service';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
afterAll(async () => { await app.close(); await pool.end(); });

describe('social auth', () => {
  const uniq = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  it('tạo tài khoản mới từ hồ sơ MXH (không mật khẩu) rồi đăng nhập lại đúng user', async () => {
    const sub = `sub-${uniq()}`;
    const email = `g_${uniq()}@example.com`;
    const a = await socialLogin({ provider: 'google', providerId: sub, email, name: 'Google User', avatarUrl: 'http://x/a.png' });
    expect(a.user.email).toBe(email);
    expect(a.user.handle).toBeTruthy();
    expect(a.tokens.accessToken).toBeTruthy();
    const [row] = await db.select().from(users).where(eq(users.id, a.user.id));
    expect(row.passwordHash).toBeNull();
    expect(row.provider).toBe('google');

    // Đăng nhập lại cùng provider → CÙNG user (không tạo trùng).
    const b = await socialLogin({ provider: 'google', providerId: sub, email, name: 'Google User', avatarUrl: null });
    expect(b.user.id).toBe(a.user.id);
  });

  it('liên kết provider vào tài khoản email sẵn có (trùng email)', async () => {
    const email = `link_${uniq()}@test.local`;
    const u = await registerUser(app, { email }); // tạo tài khoản email + mật khẩu
    const linked = await socialLogin({ provider: 'facebook', providerId: `fb-${uniq()}`, email, name: 'FB', avatarUrl: null });
    expect(linked.user.id).toBe(u.user.id); // cùng user, chỉ gắn provider
    const [row] = await db.select().from(users).where(eq(users.id, u.user.id));
    expect(row.provider).toBe('facebook');
  });

  it('tài khoản MXH không đăng nhập được bằng mật khẩu', async () => {
    const email = `a_${uniq()}@example.com`;
    await socialLogin({ provider: 'apple', providerId: `ap-${uniq()}`, email, name: 'Apple', avatarUrl: null });
    const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'whatever12' } });
    expect(res.statusCode).toBe(401);
  });

  it('POST /auth/social báo chưa cấu hình khi provider tắt; GET /auth/providers trả cờ', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/social', payload: { provider: 'google', token: 'x' } });
    expect(res.statusCode).toBe(400); // GOOGLE_CLIENT_ID không đặt trong test
    const p = await app.inject({ method: 'GET', url: '/auth/providers' });
    expect(p.json()).toMatchObject({ google: false, facebook: false, apple: false });
  });
});
