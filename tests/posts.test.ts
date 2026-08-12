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

describe('posts + rankie', () => {
  it('creates a rankie and reads it back', async () => {
    const { accessToken } = await registerUser(app);
    const rk = await createRankie(app, accessToken, { title: 'Cà phê hay trà?' });
    expect(rk.type).toBe('rankie');
    expect(rk.options).toHaveLength(3);

    const res = await app.inject({ method: 'GET', url: `/posts/${rk.id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe('Cà phê hay trà?');
  });

  it('requires auth to create', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      payload: { type: 'rankie', title: 'x', options: [{ label: 'A' }, { label: 'B' }] },
    });
    expect(res.statusCode).toBe(401);
  });

  it('records a vote and reflects it in results', async () => {
    const { accessToken } = await registerUser(app);
    const rk = await createRankie(app, accessToken);
    const optId = rk.options[0].id;

    const vote = await app.inject({
      method: 'POST',
      url: `/rankies/${rk.id}/vote`,
      headers: bearer(accessToken),
      payload: { optionIds: [optId] },
    });
    expect(vote.statusCode).toBe(200);
    expect(vote.json().options.find((o: any) => o.id === optId).votes).toBe(1);

    const results = await app.inject({ method: 'GET', url: `/rankies/${rk.id}/results` });
    expect(results.statusCode).toBe(200);
    expect(results.json().totalVotes).toBe(1);
  });

  it('re-vote moves the tally (single choice)', async () => {
    const { accessToken } = await registerUser(app);
    const rk = await createRankie(app, accessToken);
    const [a, b] = rk.options;
    await app.inject({ method: 'POST', url: `/rankies/${rk.id}/vote`, headers: bearer(accessToken), payload: { optionIds: [a.id] } });
    const res = await app.inject({ method: 'POST', url: `/rankies/${rk.id}/vote`, headers: bearer(accessToken), payload: { optionIds: [b.id] } });
    const opts = res.json().options;
    expect(opts.find((o: any) => o.id === a.id).votes).toBe(0);
    expect(opts.find((o: any) => o.id === b.id).votes).toBe(1);
  });

  it('PATCH edits metadata for the owner and 403s for others', async () => {
    const owner = await registerUser(app);
    const other = await registerUser(app);
    const rk = await createRankie(app, owner.accessToken, { title: 'Old', category: 'X' });

    const edit = await app.inject({
      method: 'PATCH',
      url: `/posts/${rk.id}`,
      headers: bearer(owner.accessToken),
      payload: { title: 'New title', category: 'Y', options: [{ id: rk.options[0].id, label: 'Edited' }] },
    });
    expect(edit.statusCode).toBe(200);
    expect(edit.json().title).toBe('New title');
    expect(edit.json().options.find((o: any) => o.id === rk.options[0].id).label).toBe('Edited');

    const forbidden = await app.inject({
      method: 'PATCH',
      url: `/posts/${rk.id}`,
      headers: bearer(other.accessToken),
      payload: { title: 'hacked' },
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it('deletes a post (owner) → then 404', async () => {
    const { accessToken } = await registerUser(app);
    const rk = await createRankie(app, accessToken);
    const del = await app.inject({ method: 'DELETE', url: `/posts/${rk.id}`, headers: bearer(accessToken) });
    expect(del.statusCode).toBe(204);
    const gone = await app.inject({ method: 'GET', url: `/posts/${rk.id}` });
    expect(gone.statusCode).toBe(404);
  });

  it('shows created posts in the unified feed', async () => {
    const { accessToken } = await registerUser(app);
    const rk = await createRankie(app, accessToken, { title: 'FeedCheck' });
    const feed = await app.inject({ method: 'GET', url: '/feed?limit=50', headers: bearer(accessToken) });
    expect(feed.statusCode).toBe(200);
    expect(feed.json().items.some((i: any) => i.id === rk.id)).toBe(true);
  });
});
