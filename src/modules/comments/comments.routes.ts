import type { FastifyInstance } from 'fastify';
import { parse } from '../../lib/validate';
import { authenticate, optionalAuth, requireUserId } from '../../plugins/auth';
import { broadcastNewComment } from '../../realtime/hub';
import {
  createCommentSchema,
  listCommentsQuerySchema,
  rankCommentSchema,
} from './comments.schemas';
import * as svc from './comments.service';

export default async function commentsRoutes(app: FastifyInstance): Promise<void> {
  // GET /posts/:id/comments?parentId=&cursor=&limit=
  app.get<{ Params: { id: string } }>(
    '/posts/:id/comments',
    { preHandler: optionalAuth },
    async (req) => {
      const query = parse(listCommentsQuerySchema, req.query);
      return svc.listComments(req.params.id, query, req.user?.id);
    },
  );

  // POST /posts/:id/comments
  app.post<{ Params: { id: string } }>(
    '/posts/:id/comments',
    { preHandler: authenticate },
    async (req, reply) => {
      const body = parse(createCommentSchema, req.body);
      const comment = await svc.createComment(requireUserId(req), req.params.id, body);
      broadcastNewComment(req.params.id, comment);
      return reply.code(201).send(comment);
    },
  );

  // PATCH /comments/:id/rank  { vote: 'up' | 'down' }
  app.patch<{ Params: { id: string } }>(
    '/comments/:id/rank',
    { preHandler: authenticate },
    async (req) => {
      const body = parse(rankCommentSchema, req.body);
      return svc.rankComment(requireUserId(req), req.params.id, body.vote);
    },
  );

  // DELETE /comments/:id — author only (soft delete)
  app.delete<{ Params: { id: string } }>(
    '/comments/:id',
    { preHandler: authenticate },
    async (req, reply) => {
      await svc.deleteComment(requireUserId(req), req.params.id);
      return reply.code(204).send();
    },
  );
}
