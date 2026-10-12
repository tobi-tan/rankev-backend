import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { pool } from '../src/db';
import { buildApp } from './helpers';
import { LEGAL_DOCS } from '../src/modules/legal/content';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
afterAll(async () => { await app.close(); await pool.end(); });

// URL khai báo với App Store / Google Play phải luôn mở được.
describe('trung tâm chính sách', () => {
  it('mục lục + mọi văn bản trả HTML; slug lạ → 404; danh sách JSON cho app', async () => {
    const hub = await app.inject({ method: 'GET', url: '/legal' });
    expect(hub.statusCode).toBe(200);
    for (const d of LEGAL_DOCS) {
      expect(hub.body).toContain(`/legal/${d.slug}`);
      const r = await app.inject({ method: 'GET', url: `/legal/${d.slug}` });
      expect(r.statusCode).toBe(200);
      expect(r.headers['content-type']).toContain('text/html');
      expect(r.body).toContain('<h1>');
    }
    for (const must of ['terms', 'privacy', 'community', 'child-safety', 'delete-account']) expect(LEGAL_DOCS.some((d) => d.slug === must)).toBe(true);
    expect((await app.inject({ method: 'GET', url: '/legal/khong-co' })).statusCode).toBe(404);
    const docs = (await app.inject({ method: 'GET', url: '/legal/docs' })).json();
    expect(docs.items.length).toBe(LEGAL_DOCS.length);
  });
});
