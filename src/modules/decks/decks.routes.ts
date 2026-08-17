import type { FastifyInstance } from 'fastify';
import { parse } from '../../lib/validate';
import { authenticate, requireUserId } from '../../plugins/auth';
import { submitDeckSchema } from './decks.schemas';
import * as decks from './decks.service';

export default async function decksRoutes(app: FastifyInstance): Promise<void> {
  // POST /decks/:id/submit
  app.post<{ Params: { id: string } }>(
    '/:id/submit',
    { preHandler: authenticate },
    async (req) => {
      const body = parse(submitDeckSchema, req.body);
      return decks.submitDeck(requireUserId(req), req.params.id, body);
    },
  );

  // GET /decks/:id/my-result
  app.get<{ Params: { id: string } }>(
    '/:id/my-result',
    { preHandler: authenticate },
    async (req) => {
      const result = await decks.getMyResult(requireUserId(req), req.params.id);
      return { result };
    },
  );

  // GET /decks/:id/stats
  app.get<{ Params: { id: string } }>('/:id/stats', async (req) => {
    return decks.getStats(req.params.id);
  });

  // GET /decks/:id/results — bảng kết quả tổng hợp cho CHỦ bài (per-question + phổ điểm).
  app.get<{ Params: { id: string } }>('/:id/results', { preHandler: authenticate }, async (req) => {
    return decks.getDeckResults(req.params.id, requireUserId(req));
  });
}
