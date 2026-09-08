import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parse } from '../../lib/validate';
import { authenticate, optionalAuth, requireUserId } from '../../plugins/auth';
import { listFeed, listTrendingTags } from './feed.service';

const feedQuerySchema = z.object({
  type: z.enum(['rankie', 'path', 'deck']).optional(),
  tag: z.string().max(60).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export default async function feedRoutes(app: FastifyInstance): Promise<void> {
  // GET /feed?type=&cursor=&limit= — unified feed of all content types
  app.get('/feed', { preHandler: optionalAuth }, async (req) => {
    const query = parse(feedQuerySchema, req.query);
    return listFeed(query, req.user?.id);
  });

  // GET /users/me/feed — personalized feed (spec alias; hides blocked authors)
  app.get('/users/me/feed', { preHandler: authenticate }, async (req) => {
    const query = parse(feedQuerySchema, req.query);
    return listFeed(query, requireUserId(req));
  });

  // GET /tags/trending — hashtag đang thịnh hành (thay danh mục cố định)
  app.get('/tags/trending', async (req) => {
    const q = parse(z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) }), req.query);
    return { items: await listTrendingTags(q.limit) };
  });
}
