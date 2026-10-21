import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, pool } from '../src/db';
import { pushSubscriptions } from '../src/db/schema';
import { bearer, buildApp, registerUser } from './helpers';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
afterAll(async () => { await app.close(); await pool.end(); });

const sub = (n: string) => ({ endpoint: `https://push.example.com/send/${n}-${Date.now()}`, keys: { p256dh: 'BPk', auth: 'aut' } });

describe('Thông báo đẩy (Web Push)', () => {
  it('GET /push/config công khai, có trường enabled', async () => {
    const r = await app.inject({ method: 'GET', url: '/push/config' });
    expect(r.statusCode).toBe(200);
    expect(typeof r.json().enabled).toBe('boolean');
  });

  it('đăng ký cần đăng nhập; lưu, chuyển chủ khi đổi tài khoản, huỷ được', async () => {
    const s = sub('a');
    expect((await app.inject({ method: 'POST', url: '/push/subscriptions', payload: s })).statusCode).toBe(401);

    const a = await registerUser(app);
    const b = await registerUser(app);
    expect((await app.inject({ method: 'POST', url: '/push/subscriptions', headers: bearer(a.accessToken), payload: s })).statusCode).toBe(200);
    let rows = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint));
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(a.user.id);

    // cùng trình duyệt, đăng nhập tài khoản khác → đăng ký thuộc về người mới (không báo nhầm người cũ)
    await app.inject({ method: 'POST', url: '/push/subscriptions', headers: bearer(b.accessToken), payload: s });
    rows = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint));
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(b.user.id);

    // người khác không huỷ hộ được
    await app.inject({ method: 'DELETE', url: '/push/subscriptions', headers: bearer(a.accessToken), payload: { endpoint: s.endpoint } });
    expect(await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint))).toHaveLength(1);
    await app.inject({ method: 'DELETE', url: '/push/subscriptions', headers: bearer(b.accessToken), payload: { endpoint: s.endpoint } });
    expect(await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint))).toHaveLength(0);
  });

  it('từ chối endpoint không phải URL', async () => {
    const a = await registerUser(app);
    const r = await app.inject({ method: 'POST', url: '/push/subscriptions', headers: bearer(a.accessToken), payload: { endpoint: 'not-a-url', keys: { p256dh: 'x', auth: 'y' } } });
    expect(r.statusCode).toBe(400);
  });
});
