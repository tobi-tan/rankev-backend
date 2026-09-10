import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parse } from '../../lib/validate';
import { authenticate, requireUserId } from '../../plugins/auth';
import { addSave, removeSave, listSaves } from './saves.service';

const refTypeSchema = z.enum(['post', 'user', 'comment']);
const addSchema = z.object({
  refType: refTypeSchema,
  refId: z.string().min(1).max(200),
  preview: z.any().optional(),
});

export default async function savesRoutes(app: FastifyInstance): Promise<void> {
  // GET /saves — kho "Đã lưu" của tôi (mọi loại), client tự nhóm/lọc
  app.get('/saves', { preHandler: authenticate }, async (req) => {
    return { items: await listSaves(requireUserId(req)) };
  });

  // POST /saves { refType, refId, preview? } — lưu (idempotent)
  app.post('/saves', { preHandler: authenticate }, async (req) => {
    const body = parse(addSchema, req.body);
    return addSave(requireUserId(req), body.refType, body.refId, body.preview);
  });

  // DELETE /saves/:refType/:refId — bỏ lưu
  app.delete<{ Params: { refType: string; refId: string } }>('/saves/:refType/:refId', { preHandler: authenticate }, async (req) => {
    const refType = refTypeSchema.parse(req.params.refType);
    return removeSave(requireUserId(req), refType, req.params.refId);
  });
}
