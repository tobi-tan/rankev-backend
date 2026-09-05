import type { FastifyInstance } from 'fastify';
import { parse } from '../../lib/validate';
import { authenticate, requireUserId } from '../../plugins/auth';
import { createDMSchema, sendMessageSchema, votePollSchema } from './messaging.schemas';
import * as chat from './messaging.service';
import * as hub from '../../realtime/hub';

export default async function messagingRoutes(app: FastifyInstance): Promise<void> {
  // GET /conversations — danh sách hội thoại (tin cuối + số chưa đọc)
  app.get('/conversations', { preHandler: authenticate }, async (req) => {
    return { items: await chat.listConversations(requireUserId(req)) };
  });

  // POST /conversations — mở (hoặc lấy) DM 1-1 với một người
  app.post('/conversations', { preHandler: authenticate }, async (req) => {
    const body = parse(createDMSchema, req.body);
    return chat.getOrCreateDM(requireUserId(req), body.userId);
  });

  // GET /conversations/:id/messages — lấy tin (và đánh dấu đã đọc)
  app.get<{ Params: { id: string } }>('/conversations/:id/messages', { preHandler: authenticate }, async (req) => {
    return { items: await chat.getMessages(req.params.id, requireUserId(req)) };
  });

  // POST /conversations/:id/messages — gửi tin (text | share | poll)
  app.post<{ Params: { id: string } }>('/conversations/:id/messages', { preHandler: authenticate }, async (req) => {
    const body = parse(sendMessageSchema, req.body);
    const msg = await chat.sendMessage(req.params.id, requireUserId(req), body);
    hub.broadcastChatMessage(req.params.id, msg);
    return msg;
  });

  // POST /messages/:id/vote — bình chọn poll trong chat
  app.post<{ Params: { id: string } }>('/messages/:id/vote', { preHandler: authenticate }, async (req) => {
    const body = parse(votePollSchema, req.body);
    const res = await chat.votePoll(req.params.id, requireUserId(req), body.optionIdx);
    hub.broadcastChatPoll(res.conversationId, {
      messageId: res.messageId,
      pollVotes: res.pollVotes,
      pollTotal: res.pollTotal,
    });
    return res;
  });
}
