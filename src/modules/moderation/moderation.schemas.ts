import { z } from 'zod';

export const REPORT_REASONS = [
  'spam',
  'harassment',
  'hate',
  'violence',
  'sexual',
  'misinformation',
  'other',
] as const;

export const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  note: z.string().max(1000).optional(),
});

export type ReportInput = z.infer<typeof reportSchema>;
