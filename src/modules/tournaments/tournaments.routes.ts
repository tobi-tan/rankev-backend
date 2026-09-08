import type { FastifyInstance } from 'fastify';
import { parse } from '../../lib/validate';
import { authenticate, optionalAuth, requireUserId } from '../../plugins/auth';
import { createTournamentSchema, setMatchResultSchema, setMatchScheduleSchema } from './tournaments.schemas';
import * as tournaments from './tournaments.service';
import { createCommentSchema, listCommentsQuerySchema } from '../comments/comments.schemas';
import * as commentsSvc from '../comments/comments.service';

export default async function tournamentsRoutes(app: FastifyInstance): Promise<void> {
  // POST /tournaments — tạo giải đấu (mỗi ván vòng đầu là 1 Rankie 1v1 thật)
  app.post('/', { preHandler: authenticate }, async (req) => {
    const body = parse(createTournamentSchema, req.body);
    return tournaments.createTournament(requireUserId(req), body);
  });

  // GET /tournaments — danh sách giải đấu cho feed (công khai, mỗi giải = 1 thẻ)
  app.get('/', { preHandler: optionalAuth }, async (req) => {
    return { items: await tournaments.listTournamentFeed(30, req.user?.id) };
  });

  // GET /tournaments/mine — giải của tôi
  app.get('/mine', { preHandler: authenticate }, async (req) => {
    return { items: await tournaments.listMyTournaments(requireUserId(req)) };
  });

  // GET /tournaments/:id — sơ đồ + phiếu từng ván (+ dự đoán của người xem nếu đăng nhập)
  app.get<{ Params: { id: string } }>('/:id', { preHandler: optionalAuth }, async (req) => {
    return tournaments.getTournament(req.params.id, req.user?.id);
  });

  // POST /tournaments/:id/matches/:round/:position/result — chủ giải nhập kết quả thật
  app.post<{ Params: { id: string; round: string; position: string } }>(
    '/:id/matches/:round/:position/result',
    { preHandler: authenticate },
    async (req) => {
      const body = parse(setMatchResultSchema, req.body);
      return tournaments.setMatchResult(req.params.id, requireUserId(req), Number(req.params.round), Number(req.params.position), body.winner);
    },
  );

  // POST /tournaments/:id/matches/:round/:position/schedule — chủ giải hẹn giờ đóng trận
  app.post<{ Params: { id: string; round: string; position: string } }>(
    '/:id/matches/:round/:position/schedule',
    { preHandler: authenticate },
    async (req) => {
      const body = parse(setMatchScheduleSchema, req.body);
      return tournaments.setMatchSchedule(req.params.id, requireUserId(req), Number(req.params.round), Number(req.params.position), body);
    },
  );

  // POST /tournaments/:id/advance — chốt vòng hiện tại (chủ giải)
  app.post<{ Params: { id: string } }>('/:id/advance', { preHandler: authenticate }, async (req) => {
    return tournaments.advanceRound(req.params.id, requireUserId(req));
  });

  // POST /tournaments/:id/bookmark — bật/tắt đánh dấu (lưu) giải đấu
  app.post<{ Params: { id: string } }>('/:id/bookmark', { preHandler: authenticate }, async (req) => {
    return tournaments.toggleTournamentBookmark(requireUserId(req), req.params.id);
  });

  // GET /tournaments/:id/comments — bình luận trên thẻ đấu
  app.get<{ Params: { id: string } }>('/:id/comments', { preHandler: optionalAuth }, async (req) => {
    const query = parse(listCommentsQuerySchema, req.query);
    return commentsSvc.listTournamentComments(req.params.id, query, req.user?.id);
  });

  // POST /tournaments/:id/comments — bình luận trên thẻ đấu
  app.post<{ Params: { id: string } }>('/:id/comments', { preHandler: authenticate }, async (req, reply) => {
    const body = parse(createCommentSchema, req.body);
    const comment = await commentsSvc.createTournamentComment(requireUserId(req), req.params.id, body);
    return reply.code(201).send(comment);
  });
}
