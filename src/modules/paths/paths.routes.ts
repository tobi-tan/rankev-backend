import type { FastifyInstance } from 'fastify';
import { parse } from '../../lib/validate';
import { authenticate, requireUserId } from '../../plugins/auth';
import { completePathSchema } from './paths.schemas';
import * as paths from './paths.service';

export default async function pathsRoutes(app: FastifyInstance): Promise<void> {
  // POST /paths/:id/complete
  app.post<{ Params: { id: string } }>(
    '/:id/complete',
    { preHandler: authenticate },
    async (req) => {
      const body = parse(completePathSchema, req.body);
      return paths.completePath(requireUserId(req), req.params.id, body);
    },
  );

  // GET /paths/:id/unlocks/me
  app.get<{ Params: { id: string } }>(
    '/:id/unlocks/me',
    { preHandler: authenticate },
    async (req) => {
      const endings = await paths.getUnlocks(requireUserId(req), req.params.id);
      return { endings };
    },
  );

  // GET /paths/:id/companions — everyone who played (>5 endings)
  app.get<{ Params: { id: string } }>('/:id/companions', async (req) => {
    const companions = await paths.getAllCompanions(req.params.id);
    return { companions };
  });

  // GET /paths/:id/companions/:endingName
  app.get<{ Params: { id: string; endingName: string } }>(
    '/:id/companions/:endingName',
    async (req) => {
      const companions = await paths.getCompanions(
        req.params.id,
        decodeURIComponent(req.params.endingName),
      );
      return { companions };
    },
  );
}
