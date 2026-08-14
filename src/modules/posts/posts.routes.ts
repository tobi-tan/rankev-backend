import type { FastifyInstance } from 'fastify';
import { parse } from '../../lib/validate';
import { badRequest } from '../../lib/errors';
import { authenticate, optionalAuth, requireUserId } from '../../plugins/auth';
import { createRankieSchema, listPostsQuerySchema, updatePostSchema } from './posts.schemas';
import * as postsService from './posts.service';
import { createPathSchema } from '../paths/paths.schemas';
import * as pathsService from '../paths/paths.service';
import { createDeckSchema } from '../decks/decks.schemas';
import * as decksService from '../decks/decks.service';

export default async function postsRoutes(app: FastifyInstance): Promise<void> {
  // GET /posts?type=rankie&category=&cursor=&limit=
  app.get('/', { preHandler: optionalAuth }, async (req) => {
    const query = parse(listPostsQuerySchema, req.query);
    return postsService.listRankies(query, req.user?.id);
  });

  // GET /posts/:id — dispatches on content type.
  app.get<{ Params: { id: string } }>('/:id', { preHandler: optionalAuth }, async (req) => {
    const kind = await postsService.getPostKind(req.params.id);
    const viewerId = req.user?.id;
    if (kind === 'path') return pathsService.getPathById(req.params.id, viewerId);
    if (kind === 'deck') return decksService.getDeckById(req.params.id, viewerId);
    return postsService.getRankieById(req.params.id, viewerId);
  });

  // POST /posts — create rankie | path | deck (dispatched on body.type).
  app.post('/', { preHandler: authenticate }, async (req, reply) => {
    const userId = requireUserId(req);
    const type = (req.body as { type?: string } | undefined)?.type ?? 'rankie';

    if (type === 'path') {
      const body = parse(createPathSchema, req.body);
      return reply.code(201).send(await pathsService.createPath(userId, body));
    }
    if (type === 'deck') {
      const body = parse(createDeckSchema, req.body);
      return reply.code(201).send(await decksService.createDeck(userId, body));
    }
    if (type === 'rankie') {
      const body = parse(createRankieSchema, req.body);
      return reply.code(201).send(await postsService.createRankie(userId, body));
    }
    throw badRequest(`Unsupported post type "${type}"`);
  });

  // PATCH /posts/:id — edit (author only); returns the refreshed view by type.
  // Body có type=path/deck (kèm cấu trúc đầy đủ) → sửa toàn bộ câu hỏi/đáp án/kết thúc.
  // Ngược lại → sửa metadata + options rankie (updatePostSchema).
  app.patch<{ Params: { id: string } }>('/:id', { preHandler: authenticate }, async (req) => {
    const userId = requireUserId(req);
    const id = req.params.id;
    const bodyType = (req.body as { type?: string } | undefined)?.type;
    if (bodyType === 'path') {
      return pathsService.updatePath(id, userId, parse(createPathSchema, req.body));
    }
    if (bodyType === 'deck') {
      return decksService.updateDeck(id, userId, parse(createDeckSchema, req.body));
    }
    const body = parse(updatePostSchema, req.body);
    const kind = await postsService.updatePost(id, userId, body);
    if (kind === 'path') return pathsService.getPathById(id, userId);
    if (kind === 'deck') return decksService.getDeckById(id, userId);
    return postsService.getRankieById(id, userId);
  });

  // DELETE /posts/:id — author only
  app.delete<{ Params: { id: string } }>('/:id', { preHandler: authenticate }, async (req, reply) => {
    await postsService.deletePost(req.params.id, requireUserId(req));
    return reply.code(204).send();
  });
}
