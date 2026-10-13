import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { pool } from '../src/db';
import { outbox } from '../src/lib/mailer';
import { buildApp, registerUser, uniqHandle, bearer } from './helpers';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
afterAll(async () => { await app.close(); await pool.end(); });

const codeFor = (to: string) => {
  const m = [...outbox].reverse().find((x) => x.to === to && x.subject.includes('xác minh email'));
  return m ? (m.text.match(/\b(\d{6})\b/) || [])[1] : undefined;
};

describe('xác minh email "mềm"', () => {
  it('đăng ký → tự gửi mã; nhập sai bị từ chối; nhập đúng → đã xác minh; không chặn dùng app', async () => {
    const h = uniqHandle();
    const email = `${h}@test.local`;
    const u = await registerUser(app, { handle: h, email });
    await new Promise((r) => setTimeout(r, 100)); // mã gửi nền
    const code = codeFor(email);
    expect(code).toMatch(/^\d{6}$/);

    const me = async () => (await app.inject({ method: 'GET', url: '/users/me', headers: bearer(u.accessToken) })).json().user;
    expect((await me()).emailVerified).toBe(false);
    // chưa xác minh vẫn dùng app bình thường (vd xem feed)
    expect((await app.inject({ method: 'GET', url: '/feed', headers: bearer(u.accessToken) })).statusCode).toBe(200);

    const wrong = code === '000000' ? '111111' : '000000';
    expect((await app.inject({ method: 'POST', url: '/auth/verify-email', headers: bearer(u.accessToken), payload: { code: wrong } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/auth/verify-email', headers: bearer(u.accessToken), payload: { code } })).statusCode).toBe(204);
    expect((await me()).emailVerified).toBe(true);

    const again = await app.inject({ method: 'POST', url: '/auth/verify-email/send', headers: bearer(u.accessToken) });
    expect(again.json().status).toBe('already');
    expect((await app.inject({ method: 'POST', url: '/auth/verify-email/send' })).statusCode).toBe(401);
  });

  it('gửi lại tối đa 3 lần/giờ', async () => {
    const u = await registerUser(app);
    await new Promise((r) => setTimeout(r, 100));
    const send = async () => (await app.inject({ method: 'POST', url: '/auth/verify-email/send', headers: bearer(u.accessToken) })).json().status;
    expect(await send()).toBe('sent');
    expect(await send()).toBe('sent');
    expect(await send()).toBe('limited'); // lần đăng ký + 2 lần gửi lại = 3
  });
});
