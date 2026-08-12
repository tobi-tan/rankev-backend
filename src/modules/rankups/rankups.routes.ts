import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parse } from '../../lib/validate';
import { authenticate, requireUserId } from '../../plugins/auth';
import { setRankUp } from './rankups.service';

const rankUpSchema = z.object({ tier: z.number().int().min(0).max(3) });

export default async function rankupsRoutes(app: FastifyInstance): Promise<void> {
  // POST /users/:id/rankup  { tier: 0|1|2|3 }  (0 removes)
  app.post<{ Params: { id: string } }>(
    '/users/:id/rankup',
    { preHandler: authenticate },
    async (req) => {
      const body = parse(rankUpSchema, req.body);
      return setRankUp(requireUserId(req), req.params.id, body.tier);
    },
  );
}
