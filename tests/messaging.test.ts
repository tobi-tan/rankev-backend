import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { pool } from '../src/db';
import { bearer, buildApp, createRankie, registerUser } from './helpers';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('messaging', () => {
  it('opens a DM idempotently, sends text, marks read', async () => {
    const alice = await registerUser(app);
    const bob = await registerUser(app);

    const open1 = await app.inject({ method: 'POST', url: '/conversations', headers: bearer(alice.accessToken), payload: { userId: bob.user.id } });
    expect(open1.statusCode).toBe(200);
    const convId = open1.json().id;
    expect(open1.json().members[0]).toMatchObject({ id: bob.user.id });

    // Idempotent — mở lại trả về cùng hội thoại
    const open2 = await app.inject({ method: 'POST', url: '/conversations', headers: bearer(bob.accessToken), payload: { userId: alice.user.id } });
    expect(open2.json().id).toBe(convId);

    // Alice gửi tin
    const send = await app.inject({ method: 'POST', url: `/conversations/${convId}/messages`, headers: bearer(alice.accessToken), payload: { body: 'Chào Bob!' } });
    expect(send.statusCode).toBe(200);
    expect(send.json()).toMatchObject({ kind: 'text', body: 'Chào Bob!', senderId: alice.user.id });

    // Bob thấy 1 chưa đọc
    const list = await app.inject({ method: 'GET', url: '/conversations', headers: bearer(bob.accessToken) });
    const conv = list.json().items.find((c: any) => c.id === convId);
    expect(conv.unread).toBe(1);
    expect(conv.lastMessage).toBe('Chào Bob!');

    // Bob đọc → hết chưa đọc
    const msgs = await app.inject({ method: 'GET', url: `/conversations/${convId}/messages`, headers: bearer(bob.accessToken) });
    expect(msgs.json().items.length).toBe(1);
    const list2 = await app.inject({ method: 'GET', url: '/conversations', headers: bearer(bob.accessToken) });
    expect(list2.json().items.find((c: any) => c.id === convId).unread).toBe(0);
  });

  it('shares a rankie and runs an inline poll', async () => {
    const alice = await registerUser(app);
    const bob = await registerUser(app);
    const rk = await createRankie(app, alice.accessToken);
    const conv = (await app.inject({ method: 'POST', url: '/conversations', headers: bearer(alice.accessToken), payload: { userId: bob.user.id } })).json();

    // Chia sẻ bài
    const share = await app.inject({ method: 'POST', url: `/conversations/${conv.id}/messages`, headers: bearer(alice.accessToken), payload: { kind: 'share', refType: 'rankie', refId: rk.id, body: 'Xem cái này!' } });
    expect(share.statusCode).toBe(200);
    expect(share.json()).toMatchObject({ kind: 'share', refType: 'rankie', refId: rk.id });

    // Tạo poll trong chat
    const poll = await app.inject({ method: 'POST', url: `/conversations/${conv.id}/messages`, headers: bearer(alice.accessToken), payload: { kind: 'poll', poll: { question: 'Trà hay cà phê?', options: [{ label: 'Trà', emoji: '🍵' }, { label: 'Cà phê', emoji: '☕' }] } } });
    expect(poll.statusCode).toBe(200);
    const pollId = poll.json().id;
    expect(poll.json().pollTotal).toBe(0);

    // Cả hai bình chọn
    const v1 = await app.inject({ method: 'POST', url: `/messages/${pollId}/vote`, headers: bearer(alice.accessToken), payload: { optionIdx: 0 } });
    expect(v1.json()).toMatchObject({ myVote: 0, pollTotal: 1 });
    const v2 = await app.inject({ method: 'POST', url: `/messages/${pollId}/vote`, headers: bearer(bob.accessToken), payload: { optionIdx: 1 } });
    expect(v2.json().pollTotal).toBe(2);
    expect(v2.json().pollVotes).toMatchObject({ 0: 1, 1: 1 });

    // Đổi phiếu (không tăng tổng)
    const v3 = await app.inject({ method: 'POST', url: `/messages/${pollId}/vote`, headers: bearer(bob.accessToken), payload: { optionIdx: 0 } });
    expect(v3.json().pollTotal).toBe(2);
    expect(v3.json()).toMatchObject({ myVote: 0 });
    expect(v3.json().pollVotes).toMatchObject({ 0: 2 });
  });

  it('blocks non-members', async () => {
    const alice = await registerUser(app);
    const bob = await registerUser(app);
    const eve = await registerUser(app);
    const conv = (await app.inject({ method: 'POST', url: '/conversations', headers: bearer(alice.accessToken), payload: { userId: bob.user.id } })).json();

    const res = await app.inject({ method: 'POST', url: `/conversations/${conv.id}/messages`, headers: bearer(eve.accessToken), payload: { body: 'len lén' } });
    expect(res.statusCode).toBe(403);
    const read = await app.inject({ method: 'GET', url: `/conversations/${conv.id}/messages`, headers: bearer(eve.accessToken) });
    expect(read.statusCode).toBe(403);
  });
});
