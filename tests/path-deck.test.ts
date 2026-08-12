import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { pool } from '../src/db';
import { bearer, buildApp, createExam, createPath, registerUser } from './helpers';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('path', () => {
  it('completes endings, accumulates unlocks, and lists companions', async () => {
    const { accessToken } = await registerUser(app);
    const path = await createPath(app, accessToken);

    const c1 = await app.inject({ method: 'POST', url: `/paths/${path.id}/complete`, headers: bearer(accessToken), payload: { endingName: 'Kết A' } });
    expect(c1.statusCode).toBe(200);
    expect(c1.json().unlockedEndings).toEqual(['Kết A']);
    expect(c1.json().endingCount).toBe(1);

    await app.inject({ method: 'POST', url: `/paths/${path.id}/complete`, headers: bearer(accessToken), payload: { endingName: 'Kết B' } });
    // re-complete A → count stays 1 (unique unlock)
    const again = await app.inject({ method: 'POST', url: `/paths/${path.id}/complete`, headers: bearer(accessToken), payload: { endingName: 'Kết A' } });
    expect(again.json().endingCount).toBe(1);

    const unlocks = await app.inject({ method: 'GET', url: `/paths/${path.id}/unlocks/me`, headers: bearer(accessToken) });
    expect(unlocks.json().endings.sort()).toEqual(['Kết A', 'Kết B']);

    const comp = await app.inject({ method: 'GET', url: `/paths/${path.id}/companions` });
    expect(comp.json().companions.length).toBeGreaterThanOrEqual(1);
  });
});

describe('deck exam grading', () => {
  it('re-grades server-side and ignores a forged client score', async () => {
    const author = await registerUser(app);
    const exam = await createExam(app, author.accessToken);
    const taker = await registerUser(app);

    const q = exam.questions;
    const correctOf = (qi: number, label: string) => q[qi].options.find((o: any) => o.label === label).id;

    // all correct, but send a fake score of 999
    const good = await app.inject({
      method: 'POST',
      url: `/decks/${exam.id}/submit`,
      headers: bearer(taker.accessToken),
      payload: { answers: { [q[0].id]: correctOf(0, '4'), [q[1].id]: correctOf(1, 'Hà Nội') }, score: 999 },
    });
    expect(good.statusCode).toBe(200);
    expect(good.json().score).toBe(10);
    expect(good.json().correctCount).toBe(2);

    // re-submit with one wrong → score 5
    const worse = await app.inject({
      method: 'POST',
      url: `/decks/${exam.id}/submit`,
      headers: bearer(taker.accessToken),
      payload: { answers: { [q[0].id]: correctOf(0, '3'), [q[1].id]: correctOf(1, 'Hà Nội') } },
    });
    expect(worse.json().score).toBe(5);

    const mine = await app.inject({ method: 'GET', url: `/decks/${exam.id}/my-result`, headers: bearer(taker.accessToken) });
    expect(mine.json().result.score).toBe(5);

    const stats = await app.inject({ method: 'GET', url: `/decks/${exam.id}/stats` });
    expect(stats.json().participants).toBe(1);
    expect(stats.json().avgScore).toBe(5);
  });

  it('never leaks correct answers in the deck view', async () => {
    const { accessToken } = await registerUser(app);
    const exam = await createExam(app, accessToken);
    const view = await app.inject({ method: 'GET', url: `/posts/${exam.id}` });
    expect(view.body).not.toContain('"correct"');
  });

  it('survey submit stores answers without a score', async () => {
    const { accessToken } = await registerUser(app);
    const survey = await app.inject({
      method: 'POST',
      url: '/posts',
      headers: bearer(accessToken),
      payload: {
        type: 'deck',
        deckMode: 'survey',
        title: 'Khảo sát',
        questions: [{ text: 'Màu?', votingType: 'single', options: [{ label: 'Đỏ' }, { label: 'Xanh' }] }],
      },
    });
    const deck = survey.json();
    const res = await app.inject({
      method: 'POST',
      url: `/decks/${deck.id}/submit`,
      headers: bearer(accessToken),
      payload: { answers: { [deck.questions[0].id]: deck.questions[0].options[0].id } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().score).toBeNull();
  });
});
