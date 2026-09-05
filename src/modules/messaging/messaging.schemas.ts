import { z } from 'zod';

export const createDMSchema = z.object({
  userId: z.string().uuid(),
});

const pollSchema = z.object({
  question: z.string().min(1).max(200),
  options: z
    .array(z.object({ label: z.string().min(1).max(80), emoji: z.string().max(16).optional() }))
    .min(2, 'Cần ít nhất 2 lựa chọn')
    .max(6),
});

export const sendMessageSchema = z
  .object({
    kind: z.enum(['text', 'share', 'poll']).optional(),
    body: z.string().max(4000).optional(),
    refType: z.string().max(16).optional(),
    refId: z.string().max(64).optional(),
    poll: pollSchema.optional(),
  })
  .refine((v) => (v.kind ?? 'text') !== 'poll' || !!v.poll, { message: 'Thiếu dữ liệu bình chọn' })
  .refine((v) => (v.kind ?? 'text') !== 'share' || !!v.refId, { message: 'Thiếu bài chia sẻ' });

export const votePollSchema = z.object({
  optionIdx: z.number().int().min(0).max(5),
});
