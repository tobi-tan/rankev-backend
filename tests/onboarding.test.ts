import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { pool } from '../src/db';
import { buildApp, registerUser, bearer } from './helpers';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
afterAll(async () => { await app.close(); await pool.end(); });

describe('onboarding: vote cộng đồng + nhân khẩu học', () => {
  it('ghi phiếu (đơn & đa chọn) và trả kết quả cộng đồng', async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);

    // đơn chọn: theme
    await app.inject({ method: 'POST', url: '/onboarding/vote', headers: bearer(a.accessToken), payload: { key: 'theme', choices: ['dark'] } });
    const r = await app.inject({ method: 'POST', url: '/onboarding/vote', headers: bearer(b.accessToken), payload: { key: 'theme', choices: ['dark'] } });
    expect(r.statusCode).toBe(200);
    expect(r.json().counts.dark).toBeGreaterThanOrEqual(2);

    // đổi lựa chọn đơn → thay thế, không cộng dồn
    const r2 = await app.inject({ method: 'POST', url: '/onboarding/vote', headers: bearer(b.accessToken), payload: { key: 'theme', choices: ['light'] } });
    const before = r.json().counts.dark;
    expect(r2.json().counts.dark).toBe(before - 1);
    expect(r2.json().counts.light).toBeGreaterThanOrEqual(1);

    // đa chọn: type
    const rt = await app.inject({ method: 'POST', url: '/onboarding/vote', headers: bearer(a.accessToken), payload: { key: 'type', choices: ['rankie', 'exam'] } });
    expect(rt.json().counts.rankie).toBeGreaterThanOrEqual(1);
    expect(rt.json().counts.exam).toBeGreaterThanOrEqual(1);

    // lựa chọn rác bị chặn
    const bad = await app.inject({ method: 'POST', url: '/onboarding/vote', headers: bearer(a.accessToken), payload: { key: 'theme', choices: ['neon'] } });
    expect(bad.statusCode).toBe(400);
  });

  it('nhân khẩu học: ẩn = riêng tư (chính chủ thấy, người khác không) nhưng vẫn vào thống kê', async () => {
    const me = await registerUser(app);
    const other = await registerUser(app);
    const res = await app.inject({
      method: 'POST', url: '/onboarding/demographics', headers: bearer(me.accessToken),
      payload: { age: '18-24', gender: 'Nữ', occupation: 'Kỹ thuật/IT', visible: { age: true, gender: false, occupation: false } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().stats.length).toBe(3); // 3 field → 3 khoá thống kê

    // Chính chủ (/users/me) thấy TẤT CẢ + cờ công khai
    const mine = await app.inject({ method: 'GET', url: '/users/me', headers: bearer(me.accessToken) });
    const mu = mine.json().user;
    expect(mu.ageRange).toBe('18-24');
    expect(mu.gender).toBe('Nữ');
    expect(mu.demographicsPublic).toMatchObject({ age: true, gender: false, occupation: false });

    // Người khác chỉ thấy field CÔNG KHAI (age), field ẩn coi như không có
    const pub = await app.inject({ method: 'GET', url: `/users/handle/${other ? me.user.handle : ''}` });
    const pu = pub.json().user;
    expect(pu.ageRange).toBe('18-24');
    expect(pu.gender).toBeUndefined();
    expect(pu.occupation).toBeUndefined();

    // Thống kê cộng đồng vẫn đếm cả field ẩn
    const stats = await app.inject({ method: 'GET', url: '/onboarding/stats?keys=gender' });
    expect(stats.json().stats.gender.counts['Nữ']).toBeGreaterThanOrEqual(1);
  });
});
