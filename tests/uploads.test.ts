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

// 1x1 transparent PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
);

function multipart(buf: Buffer, mime: string, filename: string) {
  const boundary = '----rankevtest' + Math.random().toString(36).slice(2);
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { body: Buffer.concat([head, buf, tail]), contentType: `multipart/form-data; boundary=${boundary}` };
}

describe('uploads', () => {
  it('uploads an image and serves it back', async () => {
    const { accessToken } = await registerUser(app);
    const { body, contentType } = multipart(PNG, 'image/png', 'test.png');
    const res = await app.inject({
      method: 'POST',
      url: '/uploads/image',
      headers: { ...bearer(accessToken), 'content-type': contentType },
      payload: body,
    });
    expect(res.statusCode).toBe(201);
    const url: string = res.json().url;
    expect(url).toContain('/uploads/image/');

    // GET the served path back
    const path = url.slice(url.indexOf('/uploads/'));
    const got = await app.inject({ method: 'GET', url: path });
    expect(got.statusCode).toBe(200);
    expect(got.headers['content-type']).toContain('image/png');
  });

  it('rejects a non-image file', async () => {
    const { accessToken } = await registerUser(app);
    const { body, contentType } = multipart(Buffer.from('hello'), 'text/plain', 'x.txt');
    const res = await app.inject({
      method: 'POST',
      url: '/uploads/image',
      headers: { ...bearer(accessToken), 'content-type': contentType },
      payload: body,
    });
    expect(res.statusCode).toBe(400);
  });

  it('requires auth', async () => {
    const { body, contentType } = multipart(PNG, 'image/png', 'test.png');
    const res = await app.inject({ method: 'POST', url: '/uploads/image', headers: { 'content-type': contentType }, payload: body });
    expect(res.statusCode).toBe(401);
  });
});
