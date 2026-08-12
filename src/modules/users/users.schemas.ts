import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  handle: z
    .string()
    .regex(/^[a-zA-Z0-9_]{3,20}$/, 'Handle must be 3–20 chars: letters, numbers, underscore')
    .optional(),
  bio: z.string().max(500).nullable().optional(),
  avatarEmoji: z.string().max(16).nullable().optional(),
  avatarColor: z.string().max(32).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
