import type { FastifyInstance } from 'fastify';
import { parse } from '../../lib/validate';
import { authenticate, requireUserId } from '../../plugins/auth';
import { createSessionSchema } from './sessions.schemas';
import * as svc from './sessions.service';

export default async function sessionsRoutes(app: FastifyInstance): Promise<void> {
  // POST /posts/:id/sessions — record a presentation session
  app.post<{ Params: { id: string } }>(
    '/posts/:id/sessions',
    { preHandler: authenticate },
    async (req, reply) => {
      const body = parse(createSessionSchema, req.body);
      const session = await svc.createSession(requireUserId(req), req.params.id, body);
      return reply.code(201).send(session);
    },
  );

  // GET /posts/:id/sessions — sessions for a post
  app.get<{ Params: { id: string } }>('/posts/:id/sessions', async (req) => {
    const items = await svc.getPostSessions(req.params.id);
    return { items };
  });

  // GET /users/me/sessions — sessions this user hosted
  app.get('/users/me/sessions', { preHandler: authenticate }, async (req) => {
    const items = await svc.getMySessions(requireUserId(req));
    return { items };
  });
}
