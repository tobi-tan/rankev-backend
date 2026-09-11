import type { FastifyInstance } from 'fastify';
import { authenticate, requireUserId } from '../../plugins/auth';
import * as notif from './notifications.service';

export default async function notificationsRoutes(app: FastifyInstance): Promise<void> {
  // GET /notifications — danh sách thông báo (mới nhất trước)
  app.get('/notifications', { preHandler: authenticate }, async (req) => {
    return { items: await notif.listNotifications(requireUserId(req)) };
  });

  // GET /notifications/unread-count — số thông báo chưa đọc (cho chấm đỏ)
  app.get('/notifications/unread-count', { preHandler: authenticate }, async (req) => {
    return { count: await notif.unreadCount(requireUserId(req)) };
  });

  // POST /notifications/read — đánh dấu ĐÃ ĐỌC toàn bộ
  app.post('/notifications/read', { preHandler: authenticate }, async (req) => {
    await notif.markAllRead(requireUserId(req));
    return { ok: true };
  });

  // POST /notifications/:id/read — đánh dấu đã đọc một thông báo
  app.post<{ Params: { id: string } }>('/notifications/:id/read', { preHandler: authenticate }, async (req) => {
    await notif.markRead(requireUserId(req), req.params.id);
    return { ok: true };
  });
}
