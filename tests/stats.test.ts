import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { pool } from '../src/db';
import { bearer, buildApp, createRankie, registerUser } from './helpers';
import { resetShowcaseCache } from '../src/modules/stats/stats.service';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
afterAll(async () => { await app.close(); await pool.end(); });

describe('GET /stats/showcase — số liệu thật cho slide giới thiệu', () => {
  it('công khai, đủ trường; phiếu mới được cộng vào tổng (sau khi hết đệm)', async () => {
    resetShowcaseCache();
    const r1 = await app.inject({ method: 'GET', url: '/stats/showcase' });
    expect(r1.statusCode).toBe(200);
    const a = r1.json();
    for (const k of ['users', 'posts', 'votes', 'plays', 'comments']) expect(typeof a.totals[k]).toBe('number');
    expect(Array.isArray(a.duels)).toBe(true);
    expect(Array.isArray(a.tags)).toBe(true);

    const { accessToken } = await registerUser(app);
    const rk = await createRankie(app, accessToken, { title: 'Stats test', chartType: 'head_to_head', options: [{ label: 'A' }, { label: 'B' }] });
    await app.inject({ method: 'POST', url: `/rankies/${rk.id}/vote`, headers: bearer(accessToken), payload: { optionIds: [rk.options[0].id] } });

    resetShowcaseCache();
    const b = (await app.inject({ method: 'GET', url: '/stats/showcase' })).json();
    expect(b.totals.votes).toBeGreaterThanOrEqual(a.totals.votes + 1); // test khác chạy song song cũng ghi DB
    expect(b.totals.posts).toBeGreaterThanOrEqual(a.totals.posts + 1);
    expect(b.totals.users).toBeGreaterThanOrEqual(a.totals.users + 1);
    // trận đối đầu trả đủ 2 lựa chọn, đúng thứ tự gốc
    for (const d of b.duels) expect(d.options).toHaveLength(2);
  });
});
