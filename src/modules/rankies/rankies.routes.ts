import type { FastifyInstance } from 'fastify';
import { parse } from '../../lib/validate';
import { authenticate, requireUserId } from '../../plugins/auth';
import { broadcastVoteUpdate } from '../../realtime/hub';
import { voteSchema } from './rankies.schemas';
import * as rankiesService from './rankies.service';

export default async function rankiesRoutes(app: FastifyInstance): Promise<void> {
  // POST /rankies/:id/vote — cast/replace this user's vote
  app.post<{ Params: { id: string } }>(
    '/:id/vote',
    { preHandler: authenticate },
    async (req) => {
      const body = parse(voteSchema, req.body);
      const result = await rankiesService.castVote(requireUserId(req), req.params.id, body);
      // Fan out fresh tallies to WebSocket subscribers of this rankie.
      broadcastVoteUpdate(
        req.params.id,
        result.options.map((o) => ({ id: o.id, votes: o.votes, voters: o.voters })),
      );
      return result;
    },
  );

  // GET /rankies/:id/votes/me — current user's vote (or null)
  app.get<{ Params: { id: string } }>(
    '/:id/votes/me',
    { preHandler: authenticate },
    async (req) => {
      const myVote = await rankiesService.getMyVote(requireUserId(req), req.params.id);
      return { myVote };
    },
  );

  // GET /rankies/:id/results — public vote distribution
  app.get<{ Params: { id: string } }>('/:id/results', async (req) => {
    return rankiesService.getResults(req.params.id);
  });
}
