import type { FastifyInstance } from 'fastify';
import { parse } from '../../lib/validate';
import { authenticate, requireUserId } from '../../plugins/auth';
import { reportSchema } from './moderation.schemas';
import * as mod from './moderation.service';

/**
 * Moderation endpoints (App Store UGC requirements): report content/users and
 * block users. Registered without a prefix so paths read naturally.
 */
export default async function moderationRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { id: string } }>(
    '/posts/:id/report',
    { preHandler: authenticate },
    async (req, reply) => {
      const body = parse(reportSchema, req.body);
      await mod.report(requireUserId(req), 'post', req.params.id, body);
      return reply.code(202).send({ ok: true });
    },
  );

  app.post<{ Params: { id: string } }>(
    '/comments/:id/report',
    { preHandler: authenticate },
    async (req, reply) => {
      const body = parse(reportSchema, req.body);
      await mod.report(requireUserId(req), 'comment', req.params.id, body);
      return reply.code(202).send({ ok: true });
    },
  );

  app.post<{ Params: { id: string } }>(
    '/users/:id/report',
    { preHandler: authenticate },
    async (req, reply) => {
      const body = parse(reportSchema, req.body);
      await mod.report(requireUserId(req), 'user', req.params.id, body);
      return reply.code(202).send({ ok: true });
    },
  );

  app.post<{ Params: { id: string } }>(
    '/users/:id/block',
    { preHandler: authenticate },
    async (req, reply) => {
      await mod.blockUser(requireUserId(req), req.params.id);
      return reply.code(204).send();
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/users/:id/block',
    { preHandler: authenticate },
    async (req, reply) => {
      await mod.unblockUser(requireUserId(req), req.params.id);
      return reply.code(204).send();
    },
  );
}
