import type { FastifyInstance } from 'fastify';
import { parse } from '../../lib/validate';
import { authenticate, requireUserId } from '../../plugins/auth';
import {
  addPostSchema,
  createSeriesSchema,
  renameSeriesSchema,
  reorderSchema,
} from './series.schemas';
import * as svc from './series.service';

export default async function seriesRoutes(app: FastifyInstance): Promise<void> {
  // GET /series/:id
  app.get<{ Params: { id: string } }>('/:id', async (req) => {
    return svc.getSeries(req.params.id);
  });

  // POST /series
  app.post('/', { preHandler: authenticate }, async (req, reply) => {
    const body = parse(createSeriesSchema, req.body);
    const s = await svc.createSeries(requireUserId(req), body.name);
    return reply.code(201).send(s);
  });

  // PATCH /series/:id  (rename)
  app.patch<{ Params: { id: string } }>('/:id', { preHandler: authenticate }, async (req) => {
    const body = parse(renameSeriesSchema, req.body);
    return svc.renameSeries(req.params.id, requireUserId(req), body.name);
  });

  // POST /series/:id/posts
  app.post<{ Params: { id: string } }>('/:id/posts', { preHandler: authenticate }, async (req) => {
    const body = parse(addPostSchema, req.body);
    return svc.addPost(req.params.id, requireUserId(req), body.postId, body.position);
  });

  // DELETE /series/:id/posts/:postId
  app.delete<{ Params: { id: string; postId: string } }>(
    '/:id/posts/:postId',
    { preHandler: authenticate },
    async (req, reply) => {
      await svc.removePost(req.params.id, requireUserId(req), req.params.postId);
      return reply.code(204).send();
    },
  );

  // PATCH /series/:id/reorder  { postIds: string[] }
  app.patch<{ Params: { id: string } }>(
    '/:id/reorder',
    { preHandler: authenticate },
    async (req) => {
      const body = parse(reorderSchema, req.body);
      return svc.reorder(req.params.id, requireUserId(req), body.postIds);
    },
  );
}
