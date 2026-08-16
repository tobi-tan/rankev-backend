import { mkdirSync } from 'node:fs';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { env, isProd } from './env';
import { HttpError } from './lib/errors';
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import postsRoutes from './modules/posts/posts.routes';
import rankiesRoutes from './modules/rankies/rankies.routes';
import moderationRoutes from './modules/moderation/moderation.routes';
import legalRoutes from './modules/legal/legal.routes';
import commentsRoutes from './modules/comments/comments.routes';
import bookmarksRoutes from './modules/bookmarks/bookmarks.routes';
import pathsRoutes from './modules/paths/paths.routes';
import decksRoutes from './modules/decks/decks.routes';
import feedRoutes from './modules/feed/feed.routes';
import rankupsRoutes from './modules/rankups/rankups.routes';
import seriesRoutes from './modules/series/series.routes';
import sessionsRoutes from './modules/sessions/sessions.routes';
import uploadsRoutes, { UPLOAD_DIR } from './modules/uploads/uploads.routes';
import liveRoutes from './modules/live/live.routes';
import wsRoutes from './realtime/ws.routes';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'test'
        ? false
        : {
            level: isProd ? 'info' : 'debug',
            transport: isProd
              ? undefined
              : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
          },
    trustProxy: true,
  });

  await app.register(cookie);
  await app.register(cors, {
    origin: env.CORS_ORIGIN ? env.CORS_ORIGIN.split(',').map((s) => s.trim()) : true,
    credentials: true,
  });

  // Security hardening (skipped under test so the suite isn't rate-limited).
  if (env.NODE_ENV !== 'test') {
    // CSP disabled: this is a JSON API (browser app is separate); the only HTML
    // served is the self-contained legal pages, which use inline styles.
    // CSP off (JSON API); CORP = cross-origin để frontend (Vercel) nhúng được ảnh
    // upload phục vụ từ domain backend (Railway) — nếu không trình duyệt chặn <img>.
    await app.register(helmet, {
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    });
    await app.register(rateLimit, {
      max: 300,
      timeWindow: '1 minute',
      // health checks + static uploads shouldn't count against the limit
      allowList: (req) => req.url === '/health' || req.url.startsWith('/uploads/'),
    });
  }

  await app.register(websocket);
  await app.register(multipart, { limits: { fileSize: 8 * 1024 * 1024 } });
  // Serve uploaded files. Local disk in dev; swap for S3/CDN in production.
  mkdirSync(UPLOAD_DIR, { recursive: true });
  await app.register(fastifyStatic, { root: UPLOAD_DIR, prefix: '/uploads/', decorateReply: false });

  app.get('/health', async () => ({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() }));

  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(usersRoutes, { prefix: '/users' });
  await app.register(postsRoutes, { prefix: '/posts' });
  await app.register(rankiesRoutes, { prefix: '/rankies' });
  await app.register(pathsRoutes, { prefix: '/paths' });
  await app.register(decksRoutes, { prefix: '/decks' });
  await app.register(feedRoutes);
  await app.register(rankupsRoutes);
  await app.register(seriesRoutes, { prefix: '/series' });
  await app.register(sessionsRoutes);
  await app.register(liveRoutes);
  await app.register(uploadsRoutes, { prefix: '/uploads' });
  await app.register(moderationRoutes);
  await app.register(legalRoutes);
  await app.register(commentsRoutes);
  await app.register(bookmarksRoutes);
  await app.register(wsRoutes);

  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({
      error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.url} not found` },
    });
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof HttpError) {
      return reply.code(err.statusCode).send({
        error: { code: err.code, message: err.message, details: err.details },
      });
    }

    // Postgres unique-violation → 409 (defense-in-depth beyond pre-checks).
    const pgCode = (err as { code?: string }).code;
    if (pgCode === '23505') {
      return reply.code(409).send({
        error: { code: 'CONFLICT', message: 'Resource already exists' },
      });
    }

    // Fastify's own body-parse / validation errors carry a statusCode.
    if (typeof err.statusCode === 'number' && err.statusCode < 500) {
      return reply.code(err.statusCode).send({
        error: { code: err.code ?? 'BAD_REQUEST', message: err.message },
      });
    }

    req.log.error(err);
    return reply.code(500).send({
      error: { code: 'INTERNAL', message: 'Internal server error' },
    });
  });

  return app;
}
