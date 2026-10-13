import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parse } from '../../lib/validate';
import { authenticate, requireUserId } from '../../plugins/auth';
import { assertAdmin, listReports, reportStats, resolveReport, sendTestEmail } from './admin.service';

const resolveSchema = z.object({
  targetType: z.enum(['post', 'comment', 'user']),
  targetId: z.string().uuid(),
  action: z.enum(['dismiss', 'remove', 'suspend', 'remove_suspend']),
  note: z.string().max(500).optional(),
});

/** Bàn kiểm duyệt — chỉ quản trị viên (ADMIN_EMAILS). */
export default async function adminRoutes(app: FastifyInstance): Promise<void> {
  // GET /admin/reports?status=open|done — báo cáo gộp theo nội dung
  app.get<{ Querystring: { status?: string; targetId?: string } }>('/admin/reports', { preHandler: authenticate }, async (req) => {
    await assertAdmin(requireUserId(req));
    const status = req.query.status === 'done' ? 'done' : 'open';
    const targetId = req.query.targetId && /^[0-9a-f-]{36}$/i.test(req.query.targetId) ? req.query.targetId : undefined; // tra theo mã (mã có trong email báo)
    const [items, stats] = await Promise.all([listReports(status, 100, targetId), reportStats()]);
    return { items, stats };
  });

  // POST /admin/reports/resolve — bỏ qua · gỡ nội dung · khoá tài khoản (+ báo kết quả cho người báo cáo)
  app.post('/admin/reports/resolve', { preHandler: authenticate }, async (req, reply) => {
    const adminId = requireUserId(req);
    await assertAdmin(adminId);
    const input = parse(resolveSchema, req.body);
    await resolveReport(adminId, input.targetType, input.targetId, input.action, input.note);
    return reply.code(204).send();
  });

  // POST /admin/test-email — gửi thư thử tới chính quản trị viên, trả lỗi Resend nếu có (chẩn đoán)
  app.post('/admin/test-email', { preHandler: authenticate }, async (req) => {
    const adminId = requireUserId(req);
    await assertAdmin(adminId);
    const to = (req.body as { to?: unknown } | undefined)?.to;
    const email = typeof to === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim()) ? to.trim() : undefined;
    return sendTestEmail(adminId, email);
  });
}
