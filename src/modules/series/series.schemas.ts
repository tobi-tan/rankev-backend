import { z } from 'zod';

export const createSeriesSchema = z.object({ name: z.string().min(1).max(120) });
export const renameSeriesSchema = z.object({ name: z.string().min(1).max(120) });
export const addPostSchema = z.object({
  postId: z.string().uuid(),
  position: z.number().int().min(0).optional(),
});
export const reorderSchema = z.object({ postIds: z.array(z.string().uuid()).min(1) });
