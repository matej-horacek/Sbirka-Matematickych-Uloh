import { z } from 'zod';
import { zTagQuery } from '@matematika/contracts';

// Query strings arrive as text, so numbers are coerced here
// (the generated schemas describe the values, not the raw strings).
export const listTagsQuery = z.object({
  q: zTagQuery.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListTagsQuery = z.infer<typeof listTagsQuery>;
