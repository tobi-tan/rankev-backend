import { z } from 'zod';

const deckOptionSchema = z.object({
  label: z.string().max(200).optional(),
  emoji: z.string().max(16).optional(),
  imageUrl: z.string().url().optional(),
  correct: z.boolean().optional().default(false),
});

const deckQuestionSchema = z.object({
  text: z.string().max(500).optional(),
  votingType: z.enum(['single', 'multiple', 'rating', 'text']).default('single'),
  points: z.number().min(0).max(100).optional().default(0),
  imageUrl: z.string().url().optional(),
  options: z.array(deckOptionSchema).max(20).optional().default([]),
});

export const createDeckSchema = z.object({
  type: z.literal('deck'),
  deckMode: z.enum(['survey', 'exam']),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(200).optional(),
  caption: z.string().max(2000).optional(),
  category: z.string().max(80).optional(),
  media: z
    .object({ type: z.string().optional(), color: z.string().optional(), emoji: z.string().optional(), url: z.string().url().optional() })
    .optional(),
  examDurationMinutes: z.number().int().positive().optional(),
  passingScore: z.number().min(0).optional(),
  allowGuestPresent: z.boolean().optional(),
  questions: z.array(deckQuestionSchema).min(1).max(100),
});

// answers: { [questionId]: optionId | optionId[] | freeText | null }
export const submitDeckSchema = z.object({
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string()), z.null()])),
  // client-computed values are accepted but re-verified server-side (anti-cheat)
  score: z.number().optional(),
  correctCount: z.number().optional(),
});

export type CreateDeckInput = z.infer<typeof createDeckSchema>;
export type SubmitDeckInput = z.infer<typeof submitDeckSchema>;
