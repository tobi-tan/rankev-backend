import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken } from '../lib/tokens';
import { unauthorized } from '../lib/errors';

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string };
  }
}

function extractBearer(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

/**
 * preHandler that requires a valid access token. Sets `req.user`.
 * Usage: `fastify.get('/x', { preHandler: authenticate }, handler)`
 */
export async function authenticate(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const token = extractBearer(req);
  if (!token) throw unauthorized('Missing access token');
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub };
  } catch {
    throw unauthorized('Invalid or expired access token');
  }
}

/**
 * preHandler that attaches `req.user` when a valid token is present, but never
 * rejects. Useful for feeds that personalize when logged in.
 */
export async function optionalAuth(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const token = extractBearer(req);
  if (!token) return;
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub };
  } catch {
    /* ignore — treated as anonymous */
  }
}

/** Convenience: assert and return the authenticated user id. */
export function requireUserId(req: FastifyRequest): string {
  if (!req.user) throw unauthorized();
  return req.user.id;
}
