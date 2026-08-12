import type { z } from 'zod';
import { badRequest } from './errors';

/**
 * Parse unknown input with a Zod schema, throwing a 400 HttpError (with the
 * flattened field errors) on failure. Keeps route handlers terse.
 */
export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw badRequest('Validation failed', result.error.flatten().fieldErrors);
  }
  return result.data;
}
