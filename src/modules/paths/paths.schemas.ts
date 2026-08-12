import { z } from 'zod';

const pathAnswerSchema = z.object({
  label: z.string().max(120).optional(),
  emoji: z.string().max(16).optional(),
  imageUrl: z.string().url().optional(),
  hotspotX: z.number().min(0).max(100).optional(),
  hotspotY: z.number().min(0).max(100).optional(),
  targetType: z.enum(['question', 'ending']),
  // client key referencing a question (`key`) or an ending (`name`)
  targetKey: z.string().min(1),
});

const pathQuestionSchema = z.object({
  key: z.string().min(1), // client-side id, unique within the path
  text: z.string().max(500).optional(),
  sceneImageUrl: z.string().url().optional(),
  isEntry: z.boolean().optional(),
  answers: z.array(pathAnswerSchema).min(1).max(12),
});

const pathEndingSchema = z.object({
  name: z.string().min(1).max(80),
  emoji: z.string().max(16).optional(),
  imageUrl: z.string().url().optional(),
  comment: z.string().max(500).optional(),
});

export const createPathSchema = z.object({
  type: z.literal('path'),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(200).optional(),
  caption: z.string().max(2000).optional(),
  category: z.string().max(80).optional(),
  media: z
    .object({ type: z.string().optional(), color: z.string().optional(), emoji: z.string().optional(), url: z.string().url().optional() })
    .optional(),
  revealMode: z.enum(['all', 'names', 'stats', 'hidden']).default('hidden'),
  hideEndingCount: z.boolean().optional().default(false),
  questions: z.array(pathQuestionSchema).min(1).max(50),
  endings: z.array(pathEndingSchema).min(1).max(50),
});

export const completePathSchema = z.object({
  endingName: z.string().min(1),
  previousEnding: z.string().optional(),
});

export type CreatePathInput = z.infer<typeof createPathSchema>;
export type CompletePathInput = z.infer<typeof completePathSchema>;
