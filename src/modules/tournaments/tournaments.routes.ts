import type { FastifyInstance } from 'fastify';
import { parse } from '../../lib/validate';
import { authenticate, requireUserId } from '../../plugins/auth';
import { createTournamentSchema } from './tournaments.schemas';
import * as tournaments from './tournaments.service';

export default async function tournamentsRoutes(app: FastifyInstance): Promise<void> {
  // POST /tournaments — tạo giải đấu (mỗi ván vòng đầu là 1 Rankie 1v1 thật)
  app.post('/', { preHandler: authenticate }, async (req) => {
    const body = parse(createTournamentSchema, req.body);
    return tournaments.createTournament(requireUserId(req), body);
  });

  // GET /tournaments — danh sách giải đấu cho feed (công khai, mỗi giải = 1 thẻ)
  app.get('/', async () => {
    return { items: await tournaments.listTournamentFeed() };
  });

  // GET /tournaments/mine — giải của tôi
  app.get('/mine', { preHandler: authenticate }, async (req) => {
    return { items: await tournaments.listMyTournaments(requireUserId(req)) };
  });

  // GET /tournaments/:id — sơ đồ + phiếu từng ván
  app.get<{ Params: { id: string } }>('/:id', async (req) => {
    return tournaments.getTournament(req.params.id);
  });

  // POST /tournaments/:id/advance — chốt vòng hiện tại (chủ giải)
  app.post<{ Params: { id: string } }>('/:id/advance', { preHandler: authenticate }, async (req) => {
    return tournaments.advanceRound(req.params.id, requireUserId(req));
  });
}
