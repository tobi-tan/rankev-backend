import { z } from 'zod';

export const createSessionSchema = z.object({
  name: z.string().max(120).optional(),
  participants: z.number().int().min(0).optional().default(0),
  avgScore: z.number().min(0).optional(),
  totalVotes: z.number().int().min(0).optional(),
  endedAt: z.coerce.date().optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
