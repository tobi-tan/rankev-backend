import { z } from 'zod';

const mediaSchema = z
  .object({
    type: z.string().optional(),
    color: z.string().optional(),
    emoji: z.string().optional(),
    url: z.string().url().optional(),
  })
  .optional();

const optionSchema = z
  .object({
    label: z.string().max(120).optional(),
    emoji: z.string().max(16).optional(),
    flag: z.string().max(16).optional(),
    imageUrl: z.string().url().optional(),
    color: z.string().max(32).optional(),
  })
  .refine((o) => Boolean(o.label || o.emoji || o.imageUrl), {
    message: 'Each option needs at least a label, emoji, or image',
  });

/** POST /posts — create a Rankie (Sprint 1 supports type=rankie only). */
export const createRankieSchema = z.object({
  type: z.literal('rankie').default('rankie'),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(200).optional(),
  caption: z.string().max(2000).optional(),
  category: z.string().max(80).optional(),
  media: mediaSchema,
  closesAt: z.coerce.date().optional(),
  live: z.boolean().optional().default(false),
  sponsored: z.boolean().optional().default(false),
  votingType: z.enum(['single', 'multiple', 'rating', 'unlimited']).default('single'),
  chartType: z.enum(['bar', 'pie', 'head_to_head']).default('bar'),
  options: z.array(optionSchema).min(2, 'A Rankie needs at least 2 options').max(50),
});

/** PATCH /posts/:id — edit metadata + option labels (owner only).
 * Structural option add/delete and votingType/type changes are intentionally
 * not editable here to preserve vote integrity. */
export const updatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  subtitle: z.string().max(200).nullable().optional(),
  caption: z.string().max(2000).nullable().optional(),
  category: z.string().max(80).nullable().optional(),
  media: mediaSchema.nullable(), // null = xoá ảnh bìa
  closesAt: z.coerce.date().nullable().optional(),
  live: z.boolean().optional(),
  sponsored: z.boolean().optional(),
  chartType: z.enum(['bar', 'pie', 'head_to_head']).optional(),
  revealMode: z.enum(['all', 'names', 'stats', 'hidden']).optional(),
  hideEndingCount: z.boolean().optional(),
  // Rankie options — FULL replacement when provided. Có `id` = sửa (giữ phiếu),
  // không `id` = thêm mới (0 phiếu); option cũ vắng mặt = xoá (bỏ phiếu của nó).
  options: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        label: z.string().max(120).optional(),
        emoji: z.string().max(16).optional(),
        flag: z.string().max(16).optional(),
        imageUrl: z.string().url().optional(),
        color: z.string().max(32).optional(),
        position: z.number().int().min(0).optional(),
      }),
    )
    .min(2, 'A Rankie needs at least 2 options')
    .max(50)
    .optional(),
});

export type UpdatePostInput = z.infer<typeof updatePostSchema>;

export const listPostsQuerySchema = z.object({
  type: z.enum(['rankie', 'path', 'deck']).default('rankie'),
  category: z.string().max(80).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateRankieInput = z.infer<typeof createRankieSchema>;
export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;
