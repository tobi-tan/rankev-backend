import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { pool } from '../src/db';
import { buildApp, registerUser, uniqHandle } from './helpers';
import { outbox } from '../src/lib/mailer';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
afterAll(async () => { await app.close(); await pool.end(); });
const mkUser = async () => { const h = uniqHandle(); const email = h + "@test.local"; const password = "supersecret"; await registerUser(app, { handle: h, email, password }); return { email, password }; };

const codeFrom = (to: string) => {
  const m = [...outbox].reverse().find((x) => x.to === to);
  return m ? (m.text.match(/\b(\d{6})\b/) || [])[1] : undefined;
};

describe('quên mật khẩu', () => {
  it('gửi mã → đặt lại mật khẩu → đăng nhập bằng mật khẩu mới; mã cũ hết hiệu lực', async () => {
    const u = await mkUser();
    const email = u.email;
    const r1 = await app.inject({ method: 'POST', url: '/auth/forgot', payload: { email } });
    expect(r1.statusCode).toBe(204);
    const code = codeFrom(email);
    expect(code).toMatch(/^\d{6}$/);

    const wrong = await app.inject({ method: 'POST', url: '/auth/reset', payload: { email, code: code === '000000' ? '111111' : '000000', password: 'MatKhauMoi123' } });
    expect(wrong.statusCode).toBe(400);

    const ok = await app.inject({ method: 'POST', url: '/auth/reset', payload: { email, code, password: 'MatKhauMoi123' } });
    expect(ok.statusCode).toBe(204);

    const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'MatKhauMoi123' } });
    expect(login.statusCode).toBe(200);
    const old = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: u.password } });
    expect(old.statusCode).toBe(401);

    // dùng lại mã đã dùng → bị từ chối
    const again = await app.inject({ method: 'POST', url: '/auth/reset', payload: { email, code, password: 'MatKhauKhac123' } });
    expect(again.statusCode).toBe(400);
  });

  it('email không tồn tại vẫn trả 204 và không gửi thư (không lộ tài khoản)', async () => {
    const before = outbox.length;
    const r = await app.inject({ method: 'POST', url: '/auth/forgot', payload: { email: 'khong-ton-tai@example.com' } });
    expect(r.statusCode).toBe(204);
    expect(outbox.length).toBe(before);
  });

  it('sai quá 5 lần → mã bị khoá dù sau đó nhập đúng', async () => {
    const u = await mkUser();
    await app.inject({ method: 'POST', url: '/auth/forgot', payload: { email: u.email } });
    const code = codeFrom(u.email)!;
    const bad = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await app.inject({ method: 'POST', url: '/auth/reset', payload: { email: u.email, code: bad, password: 'MatKhauMoi123' } });
    const r = await app.inject({ method: 'POST', url: '/auth/reset', payload: { email: u.email, code, password: 'MatKhauMoi123' } });
    expect(r.statusCode).toBe(400);
  });
});
