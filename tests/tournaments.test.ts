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

  it('prediction mode: advances by REAL result (owner), not by votes; exposes myPick', async () => {
    const owner = await registerUser(app);
    const voter = await registerUser(app);
    const t = (await app.inject({
      method: 'POST', url: '/tournaments', headers: bearer(owner.accessToken),
      payload: { title: 'WC dự đoán', advanceMode: 'result', contestants: [{ name: 'A' }, { name: 'B' }] },
    })).json();
    expect(t.advanceMode).toBe('result');
    const match = t.matches.find((m: any) => m.round === 0 && m.rankiePostId);
    const post = (await app.inject({ method: 'GET', url: `/posts/${match.rankiePostId}`, headers: bearer(voter.accessToken) })).json();
    const [a, b] = post.options; // position 0 = A, 1 = B

    // Đám đông bình chọn A (dự đoán A thắng).
    await app.inject({ method: 'POST', url: `/rankies/${match.rankiePostId}/vote`, headers: bearer(voter.accessToken), payload: { optionIds: [a.id] } });

    // getTournament dưới góc nhìn voter → myPick = 'a'.
    const asViewer = (await app.inject({ method: 'GET', url: `/tournaments/${t.id}`, headers: bearer(voter.accessToken) })).json();
    expect(asViewer.matches.find((m: any) => m.round === 0 && m.rankiePostId).myPick).toBe('a');

    // Chốt vòng KHI CHƯA nhập kết quả thật → 400.
    const early = await app.inject({ method: 'POST', url: `/tournaments/${t.id}/advance`, headers: bearer(owner.accessToken) });
    expect(early.statusCode).toBe(400);

    // Chủ giải nhập kết quả THẬT = B thắng (ngược với phiếu).
    await app.inject({ method: 'POST', url: `/tournaments/${t.id}/matches/0/0/result`, headers: bearer(owner.accessToken), payload: { winner: 'b' } });
    const done = (await app.inject({ method: 'POST', url: `/tournaments/${t.id}/advance`, headers: bearer(owner.accessToken) })).json();
    // Vô địch phải là B (kết quả thật), dù A nhiều phiếu hơn.
    expect(done.status).toBe('done');
    expect(done.championRef.name).toBe('B');

    // Người xem đoán A → sai (vì thật là B). Bracket vẫn giữ myPick để FE so sánh.
    const finalView = (await app.inject({ method: 'GET', url: `/tournaments/${t.id}`, headers: bearer(voter.accessToken) })).json();
    const m0 = finalView.matches.find((m: any) => m.round === 0 && m.rankiePostId);
    expect(m0.myPick).toBe('a');
    expect(m0.winnerRef.name).toBe('B'); // FE: myPick 'a' → aRef=A ≠ winner B → đoán sai
  });

  it('supports comments on the tournament (thẻ đấu)', async () => {
    const owner = await registerUser(app);
    const fan = await registerUser(app);
    const t = (await app.inject({ method: 'POST', url: '/tournaments', headers: bearer(owner.accessToken), payload: { title: 'Bàn luận', contestants: [{ name: 'A' }, { name: 'B' }] } })).json();
    const c = await app.inject({ method: 'POST', url: `/tournaments/${t.id}/comments`, headers: bearer(fan.accessToken), payload: { text: 'Đội A vô địch!' } });
    expect(c.statusCode).toBe(201);
    expect(c.json()).toMatchObject({ text: 'Đội A vô địch!', tournamentId: t.id, postId: null });
    const list = await app.inject({ method: 'GET', url: `/tournaments/${t.id}/comments` });
    expect(list.json().items.length).toBe(1);
    expect(list.json().items[0].text).toBe('Đội A vô địch!');
  });

  it('blocks voting on a match before its scheduled open time', async () => {
    const owner = await registerUser(app);
    const fan = await registerUser(app);
    const t = (await app.inject({ method: 'POST', url: '/tournaments', headers: bearer(owner.accessToken), payload: { title: 'Lịch', contestants: [{ name: 'A' }, { name: 'B' }] } })).json();
    const m = t.matches.find((x: any) => x.round === 0 && x.rankiePostId);
    const post = (await app.inject({ method: 'GET', url: `/posts/${m.rankiePostId}`, headers: bearer(fan.accessToken) })).json();
    // Owner hẹn giờ MỞ ở tương lai.
    const future = new Date(Date.now() + 3600_000).toISOString();
    await app.inject({ method: 'POST', url: `/tournaments/${t.id}/matches/0/0/schedule`, headers: bearer(owner.accessToken), payload: { opensAt: future } });
    // Vote trước giờ mở → 403.
    const early = await app.inject({ method: 'POST', url: `/rankies/${m.rankiePostId}/vote`, headers: bearer(fan.accessToken), payload: { optionIds: [post.options[0].id] } });
    expect(early.statusCode).toBe(403);
    // Bỏ giờ mở → vote được.
    await app.inject({ method: 'POST', url: `/tournaments/${t.id}/matches/0/0/schedule`, headers: bearer(owner.accessToken), payload: { opensAt: null } });
    const ok = await app.inject({ method: 'POST', url: `/rankies/${m.rankiePostId}/vote`, headers: bearer(fan.accessToken), payload: { optionIds: [post.options[0].id] } });
    expect(ok.statusCode).toBe(200);
  });

  it('bookmarks a tournament (toggle) and exposes bookmarked to the viewer', async () => {
    const owner = await registerUser(app);
    const fan = await registerUser(app);
    const t = (await app.inject({ method: 'POST', url: '/tournaments', headers: bearer(owner.accessToken), payload: { title: 'Lưu giải', contestants: [{ name: 'A' }, { name: 'B' }] } })).json();

    // Chưa lưu → bookmarked = false.
    const before = (await app.inject({ method: 'GET', url: `/tournaments/${t.id}`, headers: bearer(fan.accessToken) })).json();
    expect(before.bookmarked).toBe(false);

    // Bật lưu.
    const on = await app.inject({ method: 'POST', url: `/tournaments/${t.id}/bookmark`, headers: bearer(fan.accessToken) });
    expect(on.statusCode).toBe(200);
    expect(on.json().bookmarked).toBe(true);
    const after = (await app.inject({ method: 'GET', url: `/tournaments/${t.id}`, headers: bearer(fan.accessToken) })).json();
    expect(after.bookmarked).toBe(true);

    // Feed cũng phản ánh trạng thái lưu của người xem.
    const feed = (await app.inject({ method: 'GET', url: '/tournaments', headers: bearer(fan.accessToken) })).json();
    expect(feed.items.find((x: any) => x.id === t.id).bookmarked).toBe(true);

    // Tắt lưu.
    const off = await app.inject({ method: 'POST', url: `/tournaments/${t.id}/bookmark`, headers: bearer(fan.accessToken) });
    expect(off.json().bookmarked).toBe(false);
  });

  it('lets the owner customize a match (tên/ảnh đấu thủ) — đồng bộ vào bảng nhánh + rankie ván', async () => {
    const owner = await registerUser(app);
    const t = (await app.inject({ method: 'POST', url: '/tournaments', headers: bearer(owner.accessToken), payload: { title: 'Chỉnh', contestants: [{ name: 'A' }, { name: 'B' }] } })).json();
    const m = t.matches.find((x: any) => x.round === 0 && x.rankiePostId);

    const res = await app.inject({
      method: 'POST', url: `/tournaments/${t.id}/matches/0/0/customize`, headers: bearer(owner.accessToken),
      payload: { a: { name: 'Alpha', imageUrl: 'https://example.com/a.png' }, b: { imageUrl: 'https://example.com/b.png' } },
    });
    expect(res.statusCode).toBe(200);
    const updated = res.json().matches.find((x: any) => x.round === 0 && x.position === 0);
    expect(updated.aRef.name).toBe('Alpha');
    expect(updated.aRef.imageUrl).toBe('https://example.com/a.png');
    expect(updated.bRef.imageUrl).toBe('https://example.com/b.png');

    // Rankie ván cũng đổi theo: nhãn + ảnh lựa chọn + tiêu đề.
    const post = (await app.inject({ method: 'GET', url: `/posts/${m.rankiePostId}`, headers: bearer(owner.accessToken) })).json();
    expect(post.title).toBe('Alpha vs B');
    const oa = post.options.find((o: any) => o.position === 0);
    expect(oa.label).toBe('Alpha');
    expect(oa.imageUrl).toBe('https://example.com/a.png');

    // Người khác không phải chủ giải → 403.
    const other = await registerUser(app);
    const forbidden = await app.inject({ method: 'POST', url: `/tournaments/${t.id}/matches/0/0/customize`, headers: bearer(other.accessToken), payload: { a: { name: 'Hack' } } });
    expect(forbidden.statusCode).toBe(403);
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
