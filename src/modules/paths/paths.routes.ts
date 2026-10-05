import type { FastifyInstance } from 'fastify';
import { parse } from '../../lib/validate';
import { authenticate, optionalAuth, requireUserId } from '../../plugins/auth';
import { completePathSchema } from './paths.schemas';
import * as paths from './paths.service';
import { assertPostAccess } from '../posts/access';

export default async function pathsRoutes(app: FastifyInstance): Promise<void> {
  // POST /paths/:id/complete
  app.post<{ Params: { id: string } }>(
    '/:id/complete',
    { preHandler: authenticate },
    async (req) => {
      const body = parse(completePathSchema, req.body);
      await assertPostAccess(req.params.id, requireUserId(req));
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

  // GET /paths/:id/companions — everyone who played (>5 endings) → { companions, total }
  app.get<{ Params: { id: string } }>('/:id/companions', { preHandler: optionalAuth }, async (req) => {
    return paths.getAllCompanions(req.params.id, req.user?.id);
  });

  // GET /paths/:id/companions/:endingName → { companions, total }
  app.get<{ Params: { id: string; endingName: string } }>(
    '/:id/companions/:endingName',
    { preHandler: optionalAuth },
    async (req) => {
      return paths.getCompanions(req.params.id, decodeURIComponent(req.params.endingName), req.user?.id);
    },
  );
}
