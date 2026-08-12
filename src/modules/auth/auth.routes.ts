import type { FastifyInstance, FastifyReply } from 'fastify';
import { isProd, env } from '../../env';
import { parse } from '../../lib/validate';
import { toPublicUser } from '../users/users.serializer';
import { registerSchema, loginSchema } from './auth.schemas';
import * as authService from './auth.service';
import type { IssuedTokens } from './auth.service';

export const REFRESH_COOKIE = 'rankev_rt';
const REFRESH_COOKIE_PATH = '/auth';

function setRefreshCookie(reply: FastifyReply, tokens: IssuedTokens): void {
  reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: REFRESH_COOKIE_PATH,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
  });
}

function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
}

function readBodyRefreshToken(body: unknown): string | undefined {
  if (body && typeof body === 'object' && 'refreshToken' in body) {
    const v = (body as { refreshToken?: unknown }).refreshToken;
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}

// Stricter limits on credential endpoints to slow brute force / abuse.
// The `rateLimit` config is read by @fastify/rate-limit when registered
// (production); under test the plugin isn't registered and this is ignored.
const authLimit = { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } };

export default async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /auth/register
  app.post('/register', authLimit, async (req, reply) => {
    const body = parse(registerSchema, req.body);
    const { user, tokens } = await authService.register(body);
    setRefreshCookie(reply, tokens);
    // refreshToken is returned in the body for native clients (stored in secure
    // storage); web clients ignore it and rely on the httpOnly cookie.
    return reply.code(201).send({
      user: toPublicUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  });

  // POST /auth/login
  app.post('/login', authLimit, async (req, reply) => {
    const body = parse(loginSchema, req.body);
    const { user, tokens } = await authService.login(body);
    setRefreshCookie(reply, tokens);
    return reply.send({
      user: toPublicUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  });

  // POST /auth/refresh — accepts the refresh token from the request body
  // (native) or the httpOnly cookie (web), rotates it, returns a fresh pair.
  app.post('/refresh', async (req, reply) => {
    const raw = readBodyRefreshToken(req.body) ?? req.cookies[REFRESH_COOKIE];
    const tokens = await authService.refresh(raw);
    setRefreshCookie(reply, tokens);
    return reply.send({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  });

  // DELETE /auth/logout — revokes the refresh token (from body or cookie).
  app.delete('/logout', async (req, reply) => {
    const raw = readBodyRefreshToken(req.body) ?? req.cookies[REFRESH_COOKIE];
    await authService.logout(raw);
    clearRefreshCookie(reply);
    return reply.code(204).send();
  });
}
