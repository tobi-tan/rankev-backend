import { z } from 'zod';

export const voteSchema = z.object({
  optionIds: z.array(z.string().uuid()).min(1, 'Provide at least one optionId').max(50),
});

export type VoteInput = z.infer<typeof voteSchema>;
