import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { pool } from '../src/db';
import { bearer, buildApp, registerUser } from './helpers';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('tournaments', () => {
  it('creates a bracket where each match rankie inherits settings (ảnh, danh mục, hạn, trình chiếu)', async () => {
    const owner = await registerUser(app);
    const body = {
      title: 'GOAT?',
      category: 'Thể thao',
      caption: 'Ai vĩ đại nhất?',
      closesInHours: 24,
      allowGuestPresent: true,
      contestants: [
        { name: 'Messi', emoji: '🐐', imageUrl: 'https://example.com/messi.png' },
        { name: 'Ronaldo', color: '#DA020E' },
        { name: 'Pele' },
        { name: 'Maradona' },
      ],
    };
    const res = await app.inject({ method: 'POST', url: '/tournaments', headers: bearer(owner.accessToken), payload: body });
    expect(res.statusCode).toBe(200);
    const t = res.json();
    expect(t.rounds).toBe(2); // 4 người → bán kết + chung kết
    const round0 = t.matches.filter((m: any) => m.round === 0 && m.rankiePostId);
    expect(round0.length).toBe(2);

    // Ván đầu là một Rankie 1v1 thật kế thừa cấu hình.
    const match = await app.inject({ method: 'GET', url: `/posts/${round0[0].rankiePostId}`, headers: bearer(owner.accessToken) });
    const post = match.json();
    expect(post.type).toBe('rankie');
    expect(post.chartType).toBe('head_to_head');
    expect(post.category).toBe('Thể thao');
    expect(post.caption).toBe('Ai vĩ đại nhất?');
    expect(post.allowGuestPresent).toBe(true);
    expect(post.closesAt).toBeTruthy();
    // Đối thủ Messi mang ảnh + emoji đã đặt.
    const messi = post.options.find((o: any) => o.label === 'Messi');
    expect(messi.imageUrl).toBe('https://example.com/messi.png');
    expect(messi.emoji).toBe('🐐');

    // Mỗi giải TỰ là một series: ván (rankie) thuộc series tên = tên giải.
    expect(post.seriesName).toBe('GOAT?');
    expect(post.seriesId).toBeTruthy();
    const ser = await app.inject({ method: 'GET', url: `/series/${post.seriesId}` });
    expect(ser.statusCode).toBe(200);
    expect(ser.json().posts.length).toBe(2); // 2 ván bán kết là 2 "chương"
  });

  it('reuses settings for rounds created on advance', async () => {
    const owner = await registerUser(app);
    const res = await app.inject({
      method: 'POST', url: '/tournaments', headers: bearer(owner.accessToken),
      payload: { title: 'T', category: 'Game', closesInHours: 6, allowGuestPresent: true, contestants: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }] },
    });
    const t = res.json();
    // Chốt bán kết → sinh chung kết (rankie mới) phải kế thừa cấu hình.
    const adv = await app.inject({ method: 'POST', url: `/tournaments/${t.id}/advance`, headers: bearer(owner.accessToken) });
    const t2 = adv.json();
    const finalMatch = t2.matches.find((m: any) => m.round === 1 && m.rankiePostId);
    expect(finalMatch).toBeTruthy();
    const post = (await app.inject({ method: 'GET', url: `/posts/${finalMatch.rankiePostId}`, headers: bearer(owner.accessToken) })).json();
    expect(post.category).toBe('Game');
    expect(post.allowGuestPresent).toBe(true);
    expect(post.closesAt).toBeTruthy();
  });
});
