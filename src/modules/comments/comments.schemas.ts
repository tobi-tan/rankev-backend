import { z } from 'zod';

export const createCommentSchema = z
  .object({
    text: z.string().max(2000).optional(),
    imageUrl: z.string().url().optional(),
    emoji: z.string().max(16).optional(),
    supports: z.array(z.string()).max(50).optional(),
    parentId: z.string().uuid().optional(),
  })
  .refine((c) => Boolean(c.text?.trim() || c.imageUrl || c.emoji), {
    message: 'Comment needs text, an image, or an emoji',
  });

export const rankCommentSchema = z.object({
  vote: z.enum(['up', 'down']),
});

export const listCommentsQuerySchema = z.object({
  parentId: z.string().uuid().optional(),
  ending: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type RankCommentInput = z.infer<typeof rankCommentSchema>;
export type ListCommentsQuery = z.infer<typeof listCommentsQuerySchema>;
