import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parse } from '../../lib/validate';
import { authenticate, requireUserId } from '../../plugins/auth';
import * as svc from './live.service';

const createSchema = z.object({ postId: z.string().uuid(), name: z.string().max(120).optional() });
const joinSchema = z.object({ name: z.string().max(60).optional() });
const answersSchema = z.object({
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string()), z.null()])),
});

export default async function liveRoutes(app: FastifyInstance): Promise<void> {
  // Presenter mở phiên trực tiếp (chỉ tác giả).
  app.post('/live-sessions', { preHandler: authenticate }, async (req, reply) => {
    const body = parse(createSchema, req.body);
    const res = await svc.createLiveSession(requireUserId(req), body.postId, body.name);
    return reply.code(201).send(res);
  });

  // Người tham gia tra phiên bằng mã (công khai — không cần đăng nhập).
  app.get<{ Params: { code: string } }>('/live-sessions/code/:code', async (req) => {
    return svc.getSessionByCode(req.params.code);
  });

  // Người tham gia join bằng tên (công khai).
  app.post<{ Params: { id: string } }>('/live-sessions/:id/join', async (req) => {
    const body = parse(joinSchema, req.body);
    return svc.joinSession(req.params.id, body.name ?? 'Ẩn danh');
  });

  // Người tham gia nộp bài (công khai).
  app.post<{ Params: { id: string; pid: string } }>('/live-sessions/:id/participants/:pid/answers', async (req) => {
    const body = parse(answersSchema, req.body);
    return svc.submitLiveAnswers(req.params.id, req.params.pid, body.answers);
  });

  // Presenter xem kết quả trực tiếp (poll).
  app.get<{ Params: { id: string } }>('/live-sessions/:id/results', { preHandler: authenticate }, async (req) => {
    return svc.getLiveResults(req.params.id, requireUserId(req));
  });

  // Presenter kết thúc phiên.
  app.post<{ Params: { id: string } }>('/live-sessions/:id/end', { preHandler: authenticate }, async (req) => {
    return svc.endLiveSession(req.params.id, requireUserId(req));
  });
}
