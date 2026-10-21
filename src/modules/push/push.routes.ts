import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parse } from '../../lib/validate';
import { authenticate, requireUserId } from '../../plugins/auth';
import * as push from './push.service';

const subSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export default async function pushRoutes(app: FastifyInstance): Promise<void> {
  // GET /push/config — có bật thông báo đẩy không + khoá công khai VAPID
  app.get('/push/config', async () => push.pushConfig());

  // POST /push/subscriptions — lưu đăng ký của trình duyệt này
  app.post('/push/subscriptions', { preHandler: authenticate }, async (req) => {
    const body = parse(subSchema, req.body);
    await push.subscribe(requireUserId(req), body, req.headers['user-agent']);
    return { ok: true };
  });

  // DELETE /push/subscriptions — tắt thông báo trên trình duyệt này
  app.delete('/push/subscriptions', { preHandler: authenticate }, async (req) => {
    const body = parse(z.object({ endpoint: z.string().max(1000) }), req.body);
    await push.unsubscribe(requireUserId(req), body.endpoint);
    return { ok: true };
  });
}
