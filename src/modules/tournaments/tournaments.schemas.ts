import { z } from 'zod';

const contestantSchema = z.object({
  name: z.string().min(1).max(80),
  emoji: z.string().max(16).optional(),
  color: z.string().max(32).optional(),
  imageUrl: z.string().url().optional(),
  refType: z.enum(['post', 'user', 'comment']).optional(),
  refId: z.string().max(64).optional(),
});

export const createTournamentSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.string().max(80).optional(),
  caption: z.string().max(2000).optional(),
  // Thời gian bình chọn mỗi vòng (giờ kể từ khi ván mở). null/absent = vô hạn.
  closesInHours: z.number().int().min(1).max(8760).nullable().optional(),
  allowGuestPresent: z.boolean().optional(),
  contestants: z.array(contestantSchema).min(2, 'Cần ít nhất 2 đối thủ').max(32),
});
