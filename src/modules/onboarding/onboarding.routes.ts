import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parse } from '../../lib/validate';
import { authenticate, requireUserId } from '../../plugins/auth';
import * as onboarding from './onboarding.service';

const voteSchema = z.object({
  key: z.enum(['theme', 'type', 'rating', 'age', 'gender', 'occupation']),
  choices: z.array(z.string().min(1).max(60)).min(1).max(8),
});

const demoSchema = z.object({
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày sinh dạng YYYY-MM-DD').nullish(),
  gender: z.string().max(20).nullish(),
  occupation: z.string().max(60).nullish(),
  visible: z.record(z.boolean()).optional(),
});

export default async function onboardingRoutes(app: FastifyInstance): Promise<void> {
  // POST /onboarding/vote — ghi lựa chọn + trả kết quả cộng đồng cho khoá đó (để reveal).
  app.post('/onboarding/vote', { preHandler: authenticate }, async (req) => {
    const body = parse(voteSchema, req.body);
    return onboarding.recordVote(requireUserId(req), body.key, body.choices);
  });

  // POST /onboarding/demographics — lưu tuổi/giới tính/nghề + ẩn/công khai + trả thống kê.
  app.post('/onboarding/demographics', { preHandler: authenticate }, async (req) => {
    const body = parse(demoSchema, req.body);
    return onboarding.saveDemographics(requireUserId(req), body);
  });

  // GET /onboarding/stats — thống kê tổng (tùy chọn lọc ?keys=type,rating).
  app.get<{ Querystring: { keys?: string } }>('/onboarding/stats', async (req) => {
    const keys = req.query.keys ? req.query.keys.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
    return { stats: await onboarding.getStats(keys) };
  });
}
