import { z } from 'zod';

const contestantSchema = z.object({
  name: z.string().min(1).max(80),
  emoji: z.string().max(16).optional(),
  color: z.string().max(32).optional(),
  refType: z.enum(['post', 'user', 'comment']).optional(),
  refId: z.string().max(64).optional(),
});

export const createTournamentSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.string().max(80).optional(),
  contestants: z.array(contestantSchema).min(2, 'Cần ít nhất 2 đối thủ').max(32),
});
